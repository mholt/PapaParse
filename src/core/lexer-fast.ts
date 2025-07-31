/**
 * Fast CSV lexer optimized for inputs without quotes
 *
 * Provides high-performance parsing by bypassing quote state machine
 * when quotes are not present in the input. Includes full data processing
 * pipeline with transformations and typing.
 *
 * Based on parser's fast mode (legacy lines 1482-1513)
 */

import type { ILexer, PapaParseConfig, PapaParseError, Token } from "../types/index.js";
import type { LexerConfig } from "./lexer-config.js";

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

export class FastLexer implements ILexer {
  private input = "";
  private config: PapaParseConfig;
  private lexerConfig: LexerConfig;

  constructor(config: PapaParseConfig, lexerConfig: LexerConfig) {
    this.config = config;
    this.lexerConfig = lexerConfig;
  }

  setInput(input: string): void {
    this.input = input;
  }

  tokenize(): {
    tokens: Token[];
    errors: PapaParseError[];
    terminatedByComment?: boolean;
  } {
    // Cache config values as locals for faster access
    const newline = this.lexerConfig.newline;
    const delimiter = this.lexerConfig.delimiter;
    const comments = this.lexerConfig.comments;
    const commentsLen = typeof comments === "string" ? comments.length : 0;

    // Pre-allocate tokens array with estimated size to reduce reallocations
    const tokens: Token[] = [];
    const rows = this.input.split(newline);
    const rowsLen = rows.length;

    let position = 0;
    let hasEmittedTokens = false;

    // Main parsing loop - optimized for speed
    for (let i = 0; i < rowsLen; i++) {
      const row = rows[i];
      const rowLen = row.length;

      // Skip comment lines entirely
      if (comments && row.substring(0, commentsLen) === comments) {
        // Skip comment lines completely - don't emit any tokens
      } else {
        // If we've already emitted tokens, add newline before this row
        if (hasEmittedTokens) {
          tokens.push({
            type: TokenType.NEWLINE,
            value: newline,
            position: position - newline.length,
            length: newline.length,
          });
        }

        // Split row into fields and process immediately
        const fields = row.split(delimiter);
        const fieldsLen = fields.length;
        let fieldPos = position;

        // Optimized field processing loop
        for (let j = 0; j < fieldsLen; j++) {
          const field = fields[j];
          const fieldLen = field.length;

          tokens.push({
            type: TokenType.FIELD,
            value: field,
            position: fieldPos,
            length: fieldLen,
          });

          fieldPos += fieldLen;

          // Add delimiter token (except for last field)
          if (j < fieldsLen - 1) {
            tokens.push({
              type: TokenType.DELIMITER,
              value: delimiter,
              position: fieldPos,
              length: delimiter.length,
            });
            fieldPos += delimiter.length;
          }
        }

        hasEmittedTokens = true;
      }

      position += rowLen;
      if (i < rowsLen - 1) {
        position += newline.length;
      }
    }

    tokens.push({
      type: TokenType.EOF,
      value: "",
      position,
      length: 0,
    });

    return { tokens, errors: [] };
  }
}
