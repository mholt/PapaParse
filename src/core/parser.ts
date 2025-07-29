import type {
  PapaParseConfig,
  PapaParseError,
  PapaParseParser,
  PapaParseResult,
} from "../types/index.js";
import { isFunction, stripBom } from "../utils/index.js";
import { createLexerConfig, Lexer, type Token, TokenType } from "./lexer.js";
import { parseDynamic } from "../heuristics/dynamic-typing.js";

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
   * Fast mode parsing - bypasses lexer for performance
   * Mirrors legacy lines 1482-1513 exactly
   */
  private parseFastMode(
    input: string,
    baseIndex: number,
    ignoreLastRow: boolean,
  ): PapaParseResult {
    const newline =
      (this.config.newline as string) || this.guessLineEndings(input) || "\r\n";
    const delimiter = (this.config.delimiter as string) || ",";
    const comments =
      typeof this.config.comments === "string" ? this.config.comments : false;
    const commentsLen = comments ? comments.length : 0;

    const rows = input.split(newline);
    const data: any[][] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (i === rows.length - 1 && ignoreLastRow) {
        break;
      }

      // Skip comment lines
      if (comments && row.substring(0, commentsLen) === comments) {
        continue;
      }

      // Split row by delimiter and add to data
      let fields = row.split(delimiter);

      // Apply dynamic typing and transforms
      if (this.config.dynamicTyping || this.config.transform) {
        fields = fields.map((field, index) => {
          let value = field;

          // Apply transform if provided
          if (
            this.config.transform &&
            typeof this.config.transform === "function"
          ) {
            value = this.config.transform(value, index);
          }

          // Apply dynamic typing
          if (this.config.dynamicTyping) {
            value = parseDynamic(
              value,
              String(index),
              this.config.dynamicTyping as any,
            );
          }

          return value;
        });
      }

      data.push(fields);

      // Handle preview limit
      if (this.config.preview && data.length >= this.config.preview) {
        break;
      }
    }

    // Apply header processing and transformations
    return this.buildFastModeResult(data, baseIndex);
  }

  /**
   * Build result for fast mode parsing
   */
  private buildFastModeResult(
    data: any[][],
    baseIndex: number,
  ): PapaParseResult {
    const newline = (this.config.newline as string) || "\r\n";
    const delimiter = (this.config.delimiter as string) || ",";
    // Apply header logic if needed
    if (this.config.header && data.length > 0) {
      const headers = data[0];
      const rows = data.slice(1);

      // Convert to objects
      const objectData = rows.map((row) => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || "";
        });
        return obj;
      });

      return {
        data: objectData,
        errors: [],
        meta: {
          delimiter: delimiter,
          linebreak: newline,
          aborted: false,
          truncated: false,
          cursor: baseIndex + data.length,
        },
      };
    }

    return {
      data,
      errors: [],
      meta: {
        delimiter: delimiter,
        linebreak: newline,
        aborted: false,
        truncated: false,
        cursor: baseIndex + data.length,
      },
    };
  }

  /**
   * Guess line endings from input
   */
  private guessLineEndings(input: string): string | null {
    const crCount = (input.match(/\r/g) || []).length;
    const lfCount = (input.match(/\n/g) || []).length;
    const crlfCount = (input.match(/\r\n/g) || []).length;

    if (crlfCount > 0) return "\r\n";
    if (lfCount > crCount) return "\n";
    if (crCount > 0) return "\r";
    return null;
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

    // Fast mode bypass - mirror legacy behavior exactly (lines 1482-1513)
    const canUseFastMode =
      this.config.fastMode === true ||
      (this.config.fastMode !== false &&
        input.indexOf(this.config.quoteChar || '"') === -1);

    if (canUseFastMode && !this.config.step && !this.config.chunk) {
      return this.parseFastMode(input, baseIndex, ignoreLastRow);
    }

    // Tokenize input
    const { tokens, errors, terminatedByComment } = this.lexer.tokenize();
    this.state.errors.push(...errors);

    // Process tokens into rows
    this.processTokens(tokens, ignoreLastRow, terminatedByComment);

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
  private processTokens(
    tokens: Token[],
    ignoreLastRow: boolean,
    terminatedByComment = false,
  ): void {
    for (let i = 0; i < tokens.length && !this.state.aborted; i++) {
      const token = tokens[i];
      const prevToken = i > 0 ? tokens[i - 1] : null;

      switch (token.type) {
        case TokenType.FIELD:
          this.processField(token.value);
          break;

        case TokenType.DELIMITER:
          // Delimiter handled implicitly by field processing
          break;

        case TokenType.NEWLINE:
          // If newline comes after a delimiter, add an empty field first
          if (prevToken && prevToken.type === TokenType.DELIMITER) {
            this.processField("");
          }

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
          // If EOF comes after a delimiter, add an empty field first
          if (prevToken && prevToken.type === TokenType.DELIMITER) {
            this.processField("");
          }

          // If EOF comes after a newline, add an empty row
          // This handles cases like "a\n" where the trailing newline should create an empty row
          // But NOT if terminated by comment (e.g. "a\n# Comment")
          if (
            prevToken &&
            prevToken.type === TokenType.NEWLINE &&
            !ignoreLastRow &&
            !terminatedByComment
          ) {
            // Only add empty row if we're not already in an empty row
            if (this.state.currentRow.length === 0) {
              this.processField("");
            }
          }

          // If this is the only token (e.g., comment with newline at start), create empty row
          // But NOT if terminated by comment going to EOF (no trailing newline)
          if (
            !prevToken &&
            this.state.currentRow.length === 0 &&
            this.state.data.length === 0 &&
            !ignoreLastRow &&
            !terminatedByComment
          ) {
            this.processField("");
          }

          // Handle final row if it exists and not ignoring last row
          if (this.state.currentRow.length > 0 && !ignoreLastRow) {
            this.endCurrentRow(token.position);
          }
          break;
      }
    }
  }

  /**
   * Process a field value - transformations and typing handled by parser-handle
   */
  private processField(value: string): void {
    // Raw values only - transformations and typing handled by parser-handle
    this.state.currentRow.push(value);
    this.state.fieldCount++;
  }

  /**
   * End current row and start new one
   */
  private endCurrentRow(cursorPosition: number): void {
    this.pushRow();

    // Field validation and object conversion is now handled by parser-handle

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
    // Always push as array first
    this.state.data.push([...this.state.currentRow]);
    this.state.rowCount++;
  }

  /**
   * Convert row array to object using headers
   * Legacy reference: lines 1290-1309
   */
  private convertRowToObject(rowSource: any[]): any {
    // Headers should be the first row in data
    if (this.state.data.length === 0) {
      return rowSource;
    }

    const headers = this.state.data[0] as string[];
    const row: any = {};

    for (let j = 0; j < rowSource.length; j++) {
      const field = j >= headers.length ? "__parsed_extra" : headers[j];
      let value = rowSource[j];

      // Apply transform function with field name
      if (isFunction(this.config.transform)) {
        value = this.config.transform(value, field);
      }

      // Apply dynamic typing based on field name for header mode
      if (this.config.dynamicTyping) {
        value = this.applyDynamicTypingByField(value, field, j);
      }

      if (field === "__parsed_extra") {
        row[field] = row[field] || [];
        row[field].push(value);
      } else {
        row[field] = value;
      }
    }

    return row;
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
      const errorCode =
        actualFieldCount < expectedFieldCount
          ? "TooFewFields"
          : "TooManyFields";
      const errorMessage =
        actualFieldCount < expectedFieldCount
          ? `Too few fields: expected ${expectedFieldCount} fields but parsed ${actualFieldCount}`
          : `Too many fields: expected ${expectedFieldCount} fields but parsed ${actualFieldCount}`;

      this.state.errors.push({
        type: "FieldMismatch",
        code: errorCode,
        message: errorMessage,
        row: this.state.headerParsed
          ? this.state.data.length - 2
          : this.state.rowCount - 1, // 0-based data row index
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
   * Apply dynamic typing to field value by field name (for header mode)
   * Legacy reference: lines 1253-1277 (extracted to heuristics in Phase 3)
   */
  private applyDynamicTypingByField(
    value: any,
    fieldName: string,
    fieldIndex: number,
  ): any {
    if (typeof value !== "string") return value;

    // Check if dynamic typing is configured for this field
    if (typeof this.config.dynamicTyping === "object") {
      // Check by field name first
      if (typeof this.config.dynamicTyping[fieldName] === "boolean") {
        return this.config.dynamicTyping[fieldName]
          ? this.parseValue(value)
          : value;
      }
      // Fall back to field index
      if (typeof this.config.dynamicTyping[fieldIndex] === "boolean") {
        return this.config.dynamicTyping[fieldIndex]
          ? this.parseValue(value)
          : value;
      }
    } else if (typeof this.config.dynamicTyping === "function") {
      return this.config.dynamicTyping(fieldName)
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
    // Empty string handling - convert to null when empty
    if (value === "") return null;
    if (value.trim() === "") return value;

    // Boolean values (case insensitive)
    const lowerValue = value.toLowerCase();
    if (lowerValue === "true") return true;
    if (lowerValue === "false") return false;

    // Null values
    if (lowerValue === "null") return null;

    // Number values - check for safe integer range
    if (/^-?\d+$/.test(value)) {
      const num = parseInt(value, 10);
      // Check if number exceeds safe integer range
      if (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) {
        return value; // Keep as string for precision
      }
      return num;
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
