/**
 * Lexer configuration utilities
 */

import { CONSTANTS } from "../constants/index.js";
import type { PapaParseConfig } from "../types/index.js";

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
