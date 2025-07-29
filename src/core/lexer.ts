import { CONSTANTS } from "../constants/index.js";
import type { PapaParseConfig, PapaParseError } from "../types/index.js";
import { escapeRegExp } from "../utils/index.js";

/**
 * Token types produced by the lexer
 */
export const TokenType = {
  FIELD: "field",
  DELIMITER: "delimiter",
  NEWLINE: "newline",
  COMMENT: "comment",
  EOF: "eof",
} as const;

/**
 * Represents a lexical token with position information
 */
export interface Token {
  type: string;
  value: string;
  position: number;
  length: number;
}

/**
 * Internal lexer state for quote processing
 */
interface LexerState {
  cursor: number;
  inQuotedField: boolean;
  quoteSearch: number;
  fieldStart: number;
  errors: PapaParseError[];
  terminatedByComment: boolean;
  atStartOfRow: boolean;
}

/**
 * Configuration for the lexer (processed from Papa config)
 */
export interface LexerConfig {
  delimiter: string;
  newline: string;
  quoteChar: string;
  escapeChar: string;
  comments: string | false;
  fastMode: boolean | undefined;
}

/**
 * Core CSV lexer with optimized quote state machine
 *
 * Extracts tokens from CSV input string while handling:
 * - Quote escape sequences
 * - Field delimiters and line breaks
 * - Comment lines
 * - Fast mode optimization when no quotes present
 *
 * Based on legacy PapaParse Parser lines 1414-1683
 */
export class Lexer {
  private input = "";
  private inputLen = 0;
  private delimLen = 0;
  private newlineLen = 0;
  private commentsLen = 0;
  private quoteCharRegex: RegExp;

  // Cache frequently accessed values
  private delimiter: string;
  private newline: string;
  private quoteChar: string;
  private escapeChar: string;
  private comments: string | false;
  private fastMode: boolean | undefined;

  constructor(config: LexerConfig) {
    this.delimiter = config.delimiter;
    this.newline = config.newline;
    this.quoteChar = config.quoteChar;
    this.escapeChar = config.escapeChar;
    this.comments = config.comments;
    this.fastMode = config.fastMode;

    this.delimLen = this.delimiter.length;
    this.newlineLen = this.newline.length;
    this.commentsLen = typeof this.comments === "string" ? this.comments.length : 0;

    // Pre-compile regex for quote escape handling
    this.quoteCharRegex = new RegExp(escapeRegExp(this.escapeChar) + escapeRegExp(this.quoteChar), "g");
  }

  /**
   * Set input string for tokenization
   */
  setInput(input: string): void {
    this.input = input;
    this.inputLen = input.length;
  }

  /**
   * Tokenize entire input using fast mode when no quotes present
   * Legacy reference: lines 1482-1513
   */
  tokenizeFast(): Token[] {
    if (!this.canUseFastMode()) {
      throw new Error("Fast mode not available - quotes detected in input");
    }

    const tokens: Token[] = [];
    const rows = this.input.split(this.newline);
    let position = 0;
    let hasEmittedTokens = false;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowLen = row.length;

      // Skip comment lines entirely
      if (this.comments && row.substring(0, this.commentsLen) === this.comments) {
        // Skip comment lines completely - don't emit any tokens
      } else {
        // If we've already emitted tokens, add newline before this row
        if (hasEmittedTokens) {
          tokens.push({
            type: TokenType.NEWLINE,
            value: this.newline,
            position: position - this.newlineLen,
            length: this.newlineLen,
          });
        }

        // Split row into fields
        const fields = row.split(this.delimiter);
        let fieldPos = position;

        for (let j = 0; j < fields.length; j++) {
          const field = fields[j];

          tokens.push({
            type: TokenType.FIELD,
            value: field,
            position: fieldPos,
            length: field.length,
          });

          fieldPos += field.length;

          // Add delimiter token (except for last field)
          if (j < fields.length - 1) {
            tokens.push({
              type: TokenType.DELIMITER,
              value: this.delimiter,
              position: fieldPos,
              length: this.delimLen,
            });
            fieldPos += this.delimLen;
          }
        }

        hasEmittedTokens = true;
      }

      position += rowLen;
      if (i < rows.length - 1) {
        position += this.newlineLen;
      }
    }

    tokens.push({
      type: TokenType.EOF,
      value: "",
      position,
      length: 0,
    });

    return tokens;
  }

  /**
   * Tokenize input with full quote state machine support
   * Legacy reference: lines 1520-1683
   */
  tokenize(): {
    tokens: Token[];
    errors: PapaParseError[];
    terminatedByComment?: boolean;
  } {
    if (this.canUseFastMode()) {
      return { tokens: this.tokenizeFast(), errors: [] };
    }

    const tokens: Token[] = [];
    const state: LexerState = {
      cursor: 0,
      inQuotedField: false,
      quoteSearch: 0,
      fieldStart: 0,
      errors: [],
      terminatedByComment: false,
      atStartOfRow: true,
    };

    let nextDelim = this.input.indexOf(this.delimiter, state.cursor);
    let nextNewline = this.input.indexOf(this.newline, state.cursor);
    let _quoteSearch = this.input.indexOf(this.quoteChar, state.cursor);

    // Main parsing loop - mirrors legacy lines 1521-1682
    while (state.cursor < this.inputLen) {
      // Handle quoted fields
      if (this.input[state.cursor] === this.quoteChar) {
        const result = this.processQuotedField(state, nextDelim, nextNewline);
        tokens.push({
          type: TokenType.FIELD,
          value: result.field,
          position: state.fieldStart,
          length: state.cursor - state.fieldStart,
        });
        state.atStartOfRow = false;
        if (result.foundDelimiter) {
          tokens.push({
            type: TokenType.DELIMITER,
            value: this.delimiter,
            position: state.cursor - this.delimLen,
            length: this.delimLen,
          });
        }
        if (result.foundNewline) {
          tokens.push({
            type: TokenType.NEWLINE,
            value: this.newline,
            position: state.cursor - this.newlineLen,
            length: this.newlineLen,
          });
          state.atStartOfRow = true;
        }
        // If we hit EOF during quote processing, stop parsing
        if (result.hitEOF) {
          break;
        }
        nextDelim = this.input.indexOf(this.delimiter, state.cursor);
        nextNewline = this.input.indexOf(this.newline, state.cursor);
        _quoteSearch = this.input.indexOf(this.quoteChar, state.cursor);
        continue;
      }

      // Handle comment lines - skip them entirely
      // Legacy condition: comments && row.length === 0
      if (this.comments && state.atStartOfRow && this.isCommentStart(state.cursor)) {
        const commentResult = this.skipComment(state, nextNewline);
        if (commentResult.endsAtEOF) {
          // Comment goes to EOF - stop processing immediately (legacy line 1645)
          state.terminatedByComment = true;
          break;
        }
        // After skipping comment, we're still at start of row (comment consumed newline)
        state.atStartOfRow = true;
        nextDelim = this.input.indexOf(this.delimiter, state.cursor);
        nextNewline = this.input.indexOf(this.newline, state.cursor);
        continue;
      }

      // Handle regular fields
      const result = this.processRegularField(state, nextDelim, nextNewline);
      tokens.push({
        type: TokenType.FIELD,
        value: result.field,
        position: state.fieldStart,
        length: result.field.length,
      });
      state.atStartOfRow = false;

      if (result.foundDelimiter) {
        tokens.push({
          type: TokenType.DELIMITER,
          value: this.delimiter,
          position: state.cursor - this.delimLen,
          length: this.delimLen,
        });
        nextDelim = this.input.indexOf(this.delimiter, state.cursor);
      }

      if (result.foundNewline) {
        tokens.push({
          type: TokenType.NEWLINE,
          value: this.newline,
          position: state.cursor - this.newlineLen,
          length: this.newlineLen,
        });
        state.atStartOfRow = true;
        nextNewline = this.input.indexOf(this.newline, state.cursor);
      }

      if (result.atEOF) {
        break;
      }
    }

    tokens.push({
      type: TokenType.EOF,
      value: "",
      position: state.cursor,
      length: 0,
    });

    return {
      tokens,
      errors: state.errors,
      terminatedByComment: state.terminatedByComment,
    };
  }

  /**
   * Check if fast mode can be used (no quotes in input)
   * Legacy reference: line 1482
   */
  private canUseFastMode(): boolean {
    const hasQuotes = this.input.indexOf(this.quoteChar) !== -1;
    return this.fastMode || (this.fastMode !== false && !hasQuotes);
  }

  /**
   * Process a quoted field with escape handling
   * Legacy reference: lines 1524-1639
   */
  private processQuotedField(
    state: LexerState,
    nextDelim: number,
    nextNewline: number,
  ): {
    field: string;
    foundDelimiter: boolean;
    foundNewline: boolean;
    hitEOF: boolean;
  } {
    state.fieldStart = state.cursor;
    state.quoteSearch = state.cursor;
    state.cursor++; // Skip opening quote

    // Find closing quote with escape handling
    while (true) {
      state.quoteSearch = this.input.indexOf(this.quoteChar, state.quoteSearch + 1);

      // No closing quote found
      if (state.quoteSearch === -1) {
        state.errors.push({
          type: "Quotes",
          code: "MissingQuotes",
          message: "Quoted field unterminated",
          row: 0, // Will be filled by parser
          index: state.cursor,
        });
        // Consume everything from cursor to end of input as field value
        const field = this.input.substring(state.cursor);
        state.cursor = this.inputLen;
        return {
          field,
          foundDelimiter: false,
          foundNewline: false,
          hitEOF: true,
        };
      }

      // Closing quote at EOF
      if (state.quoteSearch === this.inputLen - 1) {
        const value = this.input
          .substring(state.cursor, state.quoteSearch)
          .replace(this.quoteCharRegex, this.quoteChar);
        state.cursor = this.inputLen;
        return {
          field: value,
          foundDelimiter: false,
          foundNewline: false,
          hitEOF: true,
        };
      }

      // Check for escaped quote
      if (this.isEscapedQuote(state.quoteSearch)) {
        // Skip escaped quote - advance past the escape sequence
        if (this.quoteChar === this.escapeChar) {
          // For "" style escaping, skip both quotes
          state.quoteSearch++;
        }
        // For \_ style escaping, just continue (no extra advance needed)
        continue;
      }

      // Update delimiter/newline positions if needed
      if (nextDelim !== -1 && nextDelim < state.quoteSearch + 1) {
        nextDelim = this.input.indexOf(this.delimiter, state.quoteSearch + 1);
      }
      if (nextNewline !== -1 && nextNewline < state.quoteSearch + 1) {
        nextNewline = this.input.indexOf(this.newline, state.quoteSearch + 1);
      }

      const checkUpTo = nextNewline === -1 ? nextDelim : Math.min(nextDelim, nextNewline);
      const spacesBetweenQuoteAndDelimiter = this.extraSpaces(state.quoteSearch, checkUpTo);

      // Check for delimiter after quote
      if (this.input.substr(state.quoteSearch + 1 + spacesBetweenQuoteAndDelimiter, this.delimLen) === this.delimiter) {
        const field = this.input
          .substring(state.cursor, state.quoteSearch)
          .replace(this.quoteCharRegex, this.quoteChar);
        state.cursor = state.quoteSearch + 1 + spacesBetweenQuoteAndDelimiter + this.delimLen;
        return {
          field,
          foundDelimiter: true,
          foundNewline: false,
          hitEOF: false,
        };
      }

      const spacesBetweenQuoteAndNewLine = this.extraSpaces(state.quoteSearch, nextNewline);

      // Check for newline after quote
      if (
        this.input.substring(
          state.quoteSearch + 1 + spacesBetweenQuoteAndNewLine,
          state.quoteSearch + 1 + spacesBetweenQuoteAndNewLine + this.newlineLen,
        ) === this.newline
      ) {
        const field = this.input
          .substring(state.cursor, state.quoteSearch)
          .replace(this.quoteCharRegex, this.quoteChar);
        state.cursor = state.quoteSearch + 1 + spacesBetweenQuoteAndNewLine + this.newlineLen;
        return {
          field,
          foundDelimiter: false,
          foundNewline: true,
          hitEOF: false,
        };
      }

      // Invalid quote placement
      state.errors.push({
        type: "Quotes",
        code: "InvalidQuotes",
        message: "Trailing quote on quoted field is malformed",
        row: 0, // Will be filled by parser
        index: state.cursor,
      });

      state.quoteSearch++;
    }
  }

  /**
   * Process a regular (unquoted) field
   * Legacy reference: lines 1652-1682
   */
  private processRegularField(
    state: LexerState,
    nextDelim: number,
    nextNewline: number,
  ): {
    field: string;
    foundDelimiter: boolean;
    foundNewline: boolean;
    atEOF: boolean;
  } {
    state.fieldStart = state.cursor;

    // Next delimiter comes before next newline
    if (nextDelim !== -1 && (nextDelim < nextNewline || nextNewline === -1)) {
      const field = this.input.substring(state.cursor, nextDelim);
      state.cursor = nextDelim + this.delimLen;
      return { field, foundDelimiter: true, foundNewline: false, atEOF: false };
    }

    // End of row
    if (nextNewline !== -1) {
      const field = this.input.substring(state.cursor, nextNewline);
      state.cursor = nextNewline + this.newlineLen;
      return { field, foundDelimiter: false, foundNewline: true, atEOF: false };
    }

    // End of input
    const field = this.input.substring(state.cursor);
    state.cursor = this.inputLen;
    return { field, foundDelimiter: false, foundNewline: false, atEOF: true };
  }

  /**
   * Skip a comment line, consuming it and its trailing newline
   * Legacy reference: lines 1642-1650
   */
  private skipComment(state: LexerState, nextNewline: number): { endsAtEOF: boolean } {
    if (nextNewline === -1) {
      // Comment goes to EOF (legacy line 1644-1645)
      state.cursor = this.inputLen;
      return { endsAtEOF: true };
    } else {
      // Move cursor past the newline (consume both comment and newline)
      state.cursor = nextNewline + this.newlineLen;
      return { endsAtEOF: false };
    }
  }

  /**
   * Check if position is start of comment line
   */
  private isCommentStart(position: number): boolean {
    if (!this.comments || this.commentsLen === 0) return false;
    return this.input.substring(position, position + this.commentsLen) === this.comments;
  }

  /**
   * Check if quote at position is escaped
   * Legacy reference: lines 1562-1572
   */
  private isEscapedQuote(quotePos: number): boolean {
    if (this.quoteChar === this.escapeChar) {
      // If quote char is escape char, check if next char is also escape char
      return this.input[quotePos + 1] === this.escapeChar;
    } else {
      // If different escape char, check if previous char is escape char
      return quotePos !== 0 && this.input[quotePos - 1] === this.escapeChar;
    }
  }

  /**
   * Count extra spaces between quote and given index
   * Legacy reference: lines 1697-1706
   */
  private extraSpaces(quotePos: number, index: number): number {
    if (index === -1) return 0;

    const textBetween = this.input.substring(quotePos + 1, index);
    if (textBetween && textBetween.trim() === "") {
      return textBetween.length;
    }
    return 0;
  }
}

/**
 * Create lexer configuration from Papa config
 */
export function createLexerConfig(config: PapaParseConfig): LexerConfig {
  // Process delimiter
  let delimiter = config.delimiter || CONSTANTS.DefaultDelimiter;
  if (typeof delimiter !== "string" || CONSTANTS.BAD_DELIMITERS.indexOf(delimiter) > -1) {
    delimiter = CONSTANTS.DefaultDelimiter;
  }

  // Process quote char
  let quoteChar = '"';
  if (config.quoteChar !== undefined && config.quoteChar !== null) {
    quoteChar = config.quoteChar;
  }

  // Process escape char
  let escapeChar = quoteChar;
  if (config.escapeChar !== undefined) {
    escapeChar = config.escapeChar;
  }

  // Process comments
  let comments: string | false = false;
  if (config.comments === delimiter) {
    throw new Error("Comment character same as delimiter");
  } else if (config.comments === (true as any)) {
    comments = "#";
  } else if (typeof config.comments === "string" && CONSTANTS.BAD_DELIMITERS.indexOf(config.comments) === -1) {
    comments = config.comments;
  }

  // Process newline
  let newline = config.newline || "\n";
  if (newline !== "\n" && newline !== "\r" && newline !== "\r\n") {
    newline = "\n";
  }

  return {
    delimiter,
    newline,
    quoteChar,
    escapeChar,
    comments,
    fastMode: config.fastMode,
  };
}
