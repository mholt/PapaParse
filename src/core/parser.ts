import type {
  PapaParseConfig,
  PapaParseError,
  PapaParseParser,
  PapaParseResult,
} from "../types/index.js";
import { isFunction, stripBom } from "../utils/index.js";
import { createLexerConfig, Lexer, type Token, TokenType } from "./lexer.js";

/**
 * Parser state for row assembly and processing
 */
interface ParserState {
  data: any[][];
  errors: PapaParseError[];
  currentRow: any[];
  rowCount: number;
  fieldCount: number;
  headerParsed: boolean;
  expectedFieldCount: number;
  renamedHeaders: { [newHeader: string]: string } | null;
  lastCursor: number;
  aborted: boolean;
}

/**
 * Result from parsing operation
 */
interface ParseResult {
  field?: string;
  endOfRow?: boolean;
  endOfFile?: boolean;
  error?: PapaParseError;
}

/**
 * Core CSV parser that handles row assembly and header processing
 *
 * Takes tokens from lexer and assembles them into structured data:
 * - Row construction from field tokens
 * - Header duplicate detection and renaming
 * - Dynamic typing and transformation
 * - Error collection and validation
 *
 * Based on legacy PapaParse Parser lines 1684-1819
 */
export class Parser implements PapaParseParser {
  private config: PapaParseConfig;
  private lexer: Lexer;
  private state: ParserState;

  constructor(config: PapaParseConfig = {}) {
    this.config = config;
    this.lexer = new Lexer(createLexerConfig(config));
    this.state = this.createInitialState();
  }

  /**
   * Parse input string and return results
   * Legacy reference: lines 1461-1806
   */
  parse(input: string, baseIndex = 0, ignoreLastRow = false): PapaParseResult {
    if (typeof input !== "string") {
      throw new Error("Input must be a string");
    }

    // Reset state for new parse
    this.state = this.createInitialState();
    this.lexer.setInput(input);

    if (!input) {
      return this.buildResult(baseIndex);
    }

    // Tokenize input
    const { tokens, errors } = this.lexer.tokenize();
    this.state.errors.push(...errors);

    // Process tokens into rows
    this.processTokens(tokens, ignoreLastRow);

    // Process headers if needed
    if (
      this.config.header &&
      !baseIndex &&
      this.state.data.length &&
      !this.state.headerParsed
    ) {
      this.processHeaders();
    }

    return this.buildResult(baseIndex);
  }

  /**
   * Set abort flag to stop parsing
   */
  abort(): void {
    this.state.aborted = true;
  }

  /**
   * Get current cursor position
   */
  getCharIndex(): number {
    return this.state.lastCursor;
  }

  /**
   * Pause parsing (not supported in direct parser)
   */
  pause(): void {
    // Direct parser doesn't support pause
    throw new Error("Pause not supported in direct parser mode");
  }

  /**
   * Resume parsing (not supported in direct parser)
   */
  resume(): void {
    // Direct parser doesn't support resume
    throw new Error("Resume not supported in direct parser mode");
  }

  /**
   * Check if paused (direct parser is never paused)
   */
  paused(): boolean {
    return false;
  }

  /**
   * Check if aborted
   */
  aborted(): boolean {
    return this.state.aborted;
  }

  /**
   * Create initial parser state
   */
  private createInitialState(): ParserState {
    return {
      data: [],
      errors: [],
      currentRow: [],
      rowCount: 0,
      fieldCount: 0,
      headerParsed: false,
      expectedFieldCount: 0,
      renamedHeaders: null,
      lastCursor: 0,
      aborted: false,
    };
  }

  /**
   * Process token stream into structured data
   */
  private processTokens(tokens: Token[], ignoreLastRow: boolean): void {
    for (let i = 0; i < tokens.length && !this.state.aborted; i++) {
      const token = tokens[i];

      switch (token.type) {
        case TokenType.FIELD:
          this.processField(token.value);
          break;

        case TokenType.DELIMITER:
          // Delimiter handled implicitly by field processing
          break;

        case TokenType.NEWLINE:
          this.endCurrentRow(token.position + token.length);

          // Check preview limit
          if (
            this.config.preview &&
            this.state.data.length >= this.config.preview
          ) {
            return;
          }
          break;

        case TokenType.EOF:
          // Handle final row if it exists and not ignoring last row
          if (this.state.currentRow.length > 0 && !ignoreLastRow) {
            this.endCurrentRow(token.position);
          }
          break;
      }
    }
  }

  /**
   * Process a field value with optional transformation
   */
  private processField(value: string): void {
    let processedValue: any = value;

    // Apply transformations
    if (isFunction(this.config.transform)) {
      processedValue = this.config.transform(
        processedValue,
        this.state.fieldCount,
      );
    }

    // Apply dynamic typing
    if (this.config.dynamicTyping) {
      processedValue = this.applyDynamicTyping(
        processedValue,
        this.state.fieldCount,
      );
    }

    this.state.currentRow.push(processedValue);
    this.state.fieldCount++;
  }

  /**
   * End current row and start new one
   */
  private endCurrentRow(cursorPosition: number): void {
    this.pushRow();
    
    // Process headers after first row in header mode
    if (this.config.header && !this.state.headerParsed && this.state.data.length === 1) {
      this.processHeaders();
    }
    
    // Field validation for header mode (after headers are processed)
    if (this.config.header && this.state.headerParsed) {
      this.validateFieldCount();
    }
    
    this.state.currentRow = [];
    this.state.fieldCount = 0;
    this.state.lastCursor = cursorPosition;

    // Execute step function if provided
    if (isFunction(this.config.step)) {
      this.executeStepFunction();
    }
  }

  /**
   * Add current row to data
   */
  private pushRow(): void {
    this.state.data.push([...this.state.currentRow]);
    this.state.rowCount++;
  }

  /**
   * Validate field count against expected count (for header mode)
   */
  private validateFieldCount(): void {
    if (!this.config.header || this.state.expectedFieldCount === 0) return;
    
    // Get actual field count from current row (last row added)
    const actualFieldCount = this.state.currentRow.length;
    const expectedFieldCount = this.state.expectedFieldCount;
    
    // Check for field count mismatch
    if (actualFieldCount !== expectedFieldCount) {
      const errorCode = actualFieldCount < expectedFieldCount ? "TooFewFields" : "TooManyFields";
      const errorMessage = actualFieldCount < expectedFieldCount 
        ? `Too few fields: expected ${expectedFieldCount} fields but parsed ${actualFieldCount}`
        : `Too many fields: expected ${expectedFieldCount} fields but parsed ${actualFieldCount}`;
      
      this.state.errors.push({
        type: "FieldMismatch",
        code: errorCode,
        message: errorMessage,
        row: this.state.rowCount - 2, // 0-based data row index (exclude header)
      });
    }
  }

  /**
   * Execute user's step function
   * Legacy reference: lines 1800-1805
   */
  private executeStepFunction(): void {
    if (!isFunction(this.config.step)) return;

    const stepResult = this.buildResult(0);
    this.config.step(stepResult, this as PapaParseParser);

    // Reset data and errors for next step
    this.state.data = [];
    this.state.errors = [];
  }

  /**
   * Process headers with duplicate detection and renaming
   * Legacy reference: lines 1743-1784
   */
  private processHeaders(): void {
    if (this.state.data.length === 0) return;

    const result = this.state.data[0];
    const headerCount = Object.create(null);
    const usedHeaders = new Set(result);
    let duplicateHeaders = false;

    for (let i = 0; i < result.length; i++) {
      let header = stripBom(result[i]);

      // Apply header transformation if provided
      if (isFunction(this.config.transformHeader)) {
        header = this.config.transformHeader(header, i);
      }

      if (!headerCount[header]) {
        headerCount[header] = 1;
        result[i] = header;
      } else {
        // Handle duplicate header
        let newHeader: string;
        let suffixCount = headerCount[header];

        // Find unique header name
        do {
          newHeader = `${header}_${suffixCount}`;
          suffixCount++;
        } while (usedHeaders.has(newHeader));

        usedHeaders.add(newHeader);
        result[i] = newHeader;
        headerCount[header]++;
        duplicateHeaders = true;

        // Track renamed headers
        if (this.state.renamedHeaders === null) {
          this.state.renamedHeaders = {};
        }
        this.state.renamedHeaders[newHeader] = header;
      }

      usedHeaders.add(header);
    }

    if (duplicateHeaders) {
      console.warn("Duplicate headers found and renamed.");
    }

    this.state.headerParsed = true;
    this.state.expectedFieldCount = result.length;
  }

  /**
   * Apply dynamic typing to field value
   * Legacy reference: lines 1253-1277 (extracted to heuristics in Phase 3)
   */
  private applyDynamicTyping(value: any, fieldIndex: number): any {
    // For now, basic implementation - will be enhanced in Phase 3
    if (typeof value !== "string") return value;

    // Check if dynamic typing is disabled for this field
    if (typeof this.config.dynamicTyping === "object") {
      if (typeof this.config.dynamicTyping[fieldIndex] === "boolean") {
        return this.config.dynamicTyping[fieldIndex]
          ? this.parseValue(value)
          : value;
      }
    } else if (typeof this.config.dynamicTyping === "function") {
      return this.config.dynamicTyping(fieldIndex)
        ? this.parseValue(value)
        : value;
    } else if (this.config.dynamicTyping === true) {
      return this.parseValue(value);
    }

    return value;
  }

  /**
   * Parse string value to appropriate type
   * Basic implementation - will be enhanced in Phase 3 heuristics
   */
  private parseValue(value: string): any {
    // Empty string handling
    if (value === "") return "";
    if (value.trim() === "") return value;

    // Boolean values
    if (value === "true") return true;
    if (value === "false") return false;

    // Null values
    if (value === "null" || value === "NULL") return null;

    // Number values
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(value)) {
      return parseFloat(value);
    }

    // ISO date format (basic check)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return date;
    }

    // Return original string if no type match
    return value;
  }

  /**
   * Build final parse result
   * Legacy reference: lines 1741-1797
   */
  private buildResult(baseIndex: number): PapaParseResult {
    const delimiter =
      typeof this.config.delimiter === "string" ? this.config.delimiter : ",";

    return {
      data: this.state.data,
      errors: this.state.errors,
      meta: {
        delimiter,
        linebreak: this.config.newline || "\n",
        aborted: this.state.aborted,
        truncated: this.config.preview
          ? this.state.data.length >= this.config.preview
          : false,
        cursor: this.state.lastCursor + baseIndex,
        renamedHeaders: this.state.renamedHeaders,
      },
    };
  }
}

/**
 * Create parser instance with configuration
 */
export function createParser(config: PapaParseConfig): Parser {
  return new Parser(config);
}
