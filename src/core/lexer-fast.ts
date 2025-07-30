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
    // Fast mode tokenization - skip complex quote processing
    const tokens: Token[] = [];
    const newline = this.lexerConfig.newline;
    const delimiter = this.lexerConfig.delimiter;
    const comments = this.lexerConfig.comments;
    const commentsLen = typeof comments === "string" ? comments.length : 0;

    const rows = this.input.split(newline);
    let position = 0;
    let hasEmittedTokens = false;

    for (let i = 0; i < rows.length; i++) {
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

        // Split row into fields
        const fields = row.split(delimiter);
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
      if (i < rows.length - 1) {
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
