import type {
  ILexer,
  PapaParseConfig,
  PapaParseError,
  PapaParseParser,
  PapaParseResult,
  Token,
} from "../types/index.js";
import { isFunction, stripBom } from "../utils/index.js";
import { createLexerConfig } from "./lexer-config.js";
import { FastLexer } from "./lexer-fast.js";
import { StandardLexer, TokenType } from "./lexer-standard.js";

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
  private lexer: ILexer;
  private state: ParserState;

  constructor(config: PapaParseConfig = {}) {
    this.config = config;
    this.lexer = this.createLexer(config);
    this.state = this.createInitialState();
  }

  /**
   * Check if fast mode can be used for the given input
   */
  private canUseFastMode(input: string): boolean {
    const lexerConfig = createLexerConfig(this.config);
    const hasQuotes = input.indexOf(lexerConfig.quoteChar) !== -1;
    return lexerConfig.fastMode || (lexerConfig.fastMode !== false && !hasQuotes);
  }

  /**
   * Create appropriate lexer instance based on configuration
   */
  private createLexer(config: PapaParseConfig): ILexer {
    const lexerConfig = createLexerConfig(config);

    // Start with FastLexer when conditions favor fast mode
    // We'll switch to StandardLexer during parse() if quotes are detected
    if (config.fastMode === true || (config.fastMode !== false && !config.step && !config.chunk)) {
      return new FastLexer(config, lexerConfig);
    }

    // Use StandardLexer for complex scenarios or when fast mode is disabled
    return new StandardLexer(lexerConfig);
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

    // Check if we need to switch from FastLexer to StandardLexer
    if (!this.canUseFastMode(input)) {
      // Switch to StandardLexer if FastLexer can't handle the input
      const lexerConfig = createLexerConfig(this.config);
      this.lexer = new StandardLexer(lexerConfig);
      this.lexer.setInput(input);
    }

    // Tokenize input
    const { tokens, errors, terminatedByComment } = this.lexer.tokenize();
    this.state.errors.push(...errors);

    // Process tokens into rows
    this.processTokens(tokens, ignoreLastRow, terminatedByComment);

    // Process headers if needed
    if (this.config.header && !baseIndex && this.state.data.length && !this.state.headerParsed) {
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
  private processTokens(tokens: Token[], ignoreLastRow: boolean, terminatedByComment = false): void {
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
          if (this.config.preview && this.state.data.length >= this.config.preview) {
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
          if (prevToken && prevToken.type === TokenType.NEWLINE && !ignoreLastRow && !terminatedByComment) {
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
   * Build final parse result
   * Legacy reference: lines 1741-1797
   */
  private buildResult(baseIndex: number): PapaParseResult {
    const delimiter = typeof this.config.delimiter === "string" ? this.config.delimiter : ",";

    return {
      data: this.state.data,
      errors: this.state.errors,
      meta: {
        delimiter,
        linebreak: this.config.newline || "\n",
        aborted: this.state.aborted,
        truncated: this.config.preview ? this.state.data.length >= this.config.preview : false,
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
