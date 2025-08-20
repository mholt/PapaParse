import type { PapaParseError } from "../types/index.js";

/**
 * Standard error codes used throughout PapaParse
 */
export const ErrorCode = {
  // Quote-related errors
  MISSING_QUOTES: "MissingQuotes",
  INVALID_QUOTES: "InvalidQuotes",

  // Delimiter-related errors
  INVALID_DELIMITER: "InvalidDelimiter",

  // Network-related errors
  NETWORK_ERROR: "NetworkError",
  DOWNLOAD_ERROR: "DownloadError",

  // File-related errors
  FILE_SIZE_ERROR: "FileSizeError",
  FILE_READ_ERROR: "FileReadError",

  // Worker-related errors
  WORKER_ERROR: "WorkerError",

  // Configuration errors
  CONFIG_ERROR: "ConfigError",

  // Generic parsing errors
  PARSE_ERROR: "ParseError",
} as const;

/**
 * Standard error types used throughout PapaParse
 */
export const ErrorType = {
  QUOTES: "Quotes",
  DELIMITER: "Delimiter",
  NETWORK: "Network",
  FILE: "File",
  WORKER: "Worker",
  CONFIG: "Config",
  PARSE: "Parse",
} as const;

/**
 * Factory functions for creating standardized errors
 */
export class ErrorFactory {
  /**
   * Create a quote-related error
   */
  static createQuoteError(
    code: "MissingQuotes" | "InvalidQuotes",
    message: string,
    row: number,
    index: number,
  ): PapaParseError {
    return {
      type: "Quotes",
      code,
      message,
      row,
      index,
    };
  }

  /**
   * Create a missing quotes error
   */
  static createMissingQuotesError(row: number, index: number): PapaParseError {
    return ErrorFactory.createQuoteError("MissingQuotes", "Quoted field unterminated", row, index);
  }

  /**
   * Create an invalid quotes error
   */
  static createInvalidQuotesError(row: number, index: number): PapaParseError {
    return ErrorFactory.createQuoteError("InvalidQuotes", "Trailing quote on quoted field is malformed", row, index);
  }

  /**
   * Create a delimiter error
   */
  static createDelimiterError(message: string, row?: number, index?: number): PapaParseError {
    return {
      type: "Delimiter",
      code: "InvalidDelimiter",
      message,
      row: row || 0,
      index: index || 0,
    };
  }

  /**
   * Create a network error
   */
  static createNetworkError(message: string, details?: any): PapaParseError {
    return {
      type: "Network",
      code: "NetworkError",
      message,
      row: 0,
      index: 0,
      details,
    };
  }

  /**
   * Create a download error
   */
  static createDownloadError(message: string, details?: any): PapaParseError {
    return {
      type: "Network",
      code: "DownloadError",
      message,
      row: 0,
      index: 0,
      details,
    };
  }

  /**
   * Create a file error
   */
  static createFileError(code: "FileSizeError" | "FileReadError", message: string, details?: any): PapaParseError {
    return {
      type: "File",
      code,
      message,
      row: 0,
      index: 0,
      details,
    };
  }

  /**
   * Create a file size error
   */
  static createFileSizeError(size: number, maxSize: number): PapaParseError {
    return ErrorFactory.createFileError(
      "FileSizeError",
      `File size (${size} bytes) exceeds maximum allowed size (${maxSize} bytes)`,
      { size, maxSize },
    );
  }

  /**
   * Create a file read error
   */
  static createFileReadError(message: string, details?: any): PapaParseError {
    return ErrorFactory.createFileError("FileReadError", message, details);
  }

  /**
   * Create a worker error
   */
  static createWorkerError(message: string, details?: any): PapaParseError {
    return {
      type: "Worker",
      code: "WorkerError",
      message,
      row: 0,
      index: 0,
      details,
    };
  }

  /**
   * Create a configuration error
   */
  static createConfigError(message: string, details?: any): PapaParseError {
    return {
      type: "Config",
      code: "ConfigError",
      message,
      row: 0,
      index: 0,
      details,
    };
  }

  /**
   * Create a generic parse error
   */
  static createParseError(message: string, row?: number, index?: number, details?: any): PapaParseError {
    return {
      type: "Parse",
      code: "ParseError",
      message,
      row: row || 0,
      index: index || 0,
      details,
    };
  }
}

/**
 * Error collection utility for managing parsing errors
 */
export class ErrorCollector {
  private errors: PapaParseError[] = [];

  /**
   * Add an error to the collection
   */
  add(error: PapaParseError): void {
    this.errors.push(error);
  }

  /**
   * Add multiple errors to the collection
   */
  addAll(errors: PapaParseError[]): void {
    this.errors.push(...errors);
  }

  /**
   * Get all collected errors
   */
  getAll(): PapaParseError[] {
    return [...this.errors];
  }

  /**
   * Get errors of a specific type
   */
  getByType(type: string): PapaParseError[] {
    return this.errors.filter((error) => error.type === type);
  }

  /**
   * Get errors of a specific code
   */
  getByCode(code: string): PapaParseError[] {
    return this.errors.filter((error) => error.code === code);
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Get error count
   */
  count(): number {
    return this.errors.length;
  }

  /**
   * Clear all errors
   */
  clear(): void {
    this.errors = [];
  }

  /**
   * Update row numbers for collected errors (used during parsing)
   */
  updateRowNumbers(offset: number): void {
    this.errors.forEach((error) => {
      if (error.row !== undefined) {
        error.row += offset;
      }
    });
  }
}

/**
 * Utility function to check if error is quote-related
 */
export function isQuoteError(error: PapaParseError): boolean {
  return error.type === "Quotes";
}

/**
 * Utility function to check if error is network-related
 */
export function isNetworkError(error: PapaParseError): boolean {
  return error.type === "Network";
}

/**
 * Utility function to check if error is file-related
 */
export function isFileError(error: PapaParseError): boolean {
  return error.type === "File";
}

/**
 * Utility function to check if error is worker-related
 */
export function isWorkerError(error: PapaParseError): boolean {
  return error.type === "Worker";
}

/**
 * Legacy error creation for compatibility
 * Maintains exact error object structure from legacy implementation
 */
export class LegacyErrorFactory {
  /**
   * Create error exactly as legacy implementation does
   * Legacy reference: lines 1542-1548, 1625-1631
   */
  static createLegacyQuoteError(
    code: "MissingQuotes" | "InvalidQuotes",
    message: string,
    row: number,
    index: number,
  ): PapaParseError {
    return {
      type: "Quotes",
      code,
      message,
      row,
      index,
    };
  }
}
