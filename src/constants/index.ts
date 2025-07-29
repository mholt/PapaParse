/**
 * PapaParse Constants
 *
 * Runtime-mutable constants to maintain exact legacy behavior.
 * These values can be modified by users and will affect subsequent parsing operations.
 */

// Special constant for Node.js streaming (matching legacy value)
export const NODE_STREAM_INPUT = 1;

// Runtime-mutable constants (exact legacy values and behavior)
const PAPA_CONSTANTS = {
  /** The true delimiter. Invisible. ASCII code 30. */
  RECORD_SEP: String.fromCharCode(30),
  /** Also sometimes used as a delimiting character. ASCII code 31. */
  UNIT_SEP: String.fromCharCode(31),
  /** Byte Order Mark */
  BYTE_ORDER_MARK: "\ufeff",
  /** The size in bytes of each file chunk for local files. Default 10 MB. MUTABLE! */
  LocalChunkSize: 1024 * 1024 * 10,
  /** Same as LocalChunkSize, but for downloading files from remote locations. Default 5 MB. MUTABLE! */
  RemoteChunkSize: 1024 * 1024 * 5,
  /** The delimiter used when it is left unspecified and cannot be detected automatically. */
  DefaultDelimiter: ",",

  // BAD_DELIMITERS computed property to include BOM (matching legacy line 68)
  get BAD_DELIMITERS() {
    return ["\r", "\n", '"', this.BYTE_ORDER_MARK];
  },
};

// Computed/derived constants
export const BAD_DELIMITERS_WITH_BOM = (): string[] => {
  return [...PAPA_CONSTANTS.BAD_DELIMITERS, PAPA_CONSTANTS.BYTE_ORDER_MARK];
};

// Default delimiters to guess when auto-detecting
export const DEFAULT_DELIMITERS_TO_GUESS = [",", "\t", "|", ";", PAPA_CONSTANTS.RECORD_SEP, PAPA_CONSTANTS.UNIT_SEP];

// Error types and codes for consistency
export const ERROR_TYPES = {
  Quotes: "Quotes",
  Delimiter: "Delimiter",
  FieldMismatch: "FieldMismatch",
} as const;

export const ERROR_CODES = {
  MissingQuotes: "MissingQuotes",
  UndetectableDelimiter: "UndetectableDelimiter",
  TooFewFields: "TooFewFields",
  TooManyFields: "TooManyFields",
  InvalidQuotes: "InvalidQuotes",
} as const;

// Default configuration values (used throughout the codebase)
export const DEFAULT_CONFIG = {
  delimiter: "", // Auto-detect
  newline: "", // Auto-detect
  quoteChar: '"',
  escapeChar: '"',
  header: false,
  dynamicTyping: false,
  preview: 0,
  encoding: "",
  worker: false,
  comments: false,
  step: false,
  complete: false,
  error: false,
  download: false,
  downloadRequestHeaders: {} as { [key: string]: string },
  downloadRequestBody: "",
  skipEmptyLines: false,
  chunk: false,
  fastMode: undefined,
  beforeFirstChunk: false,
  withCredentials: false,
  transform: false,
  transformHeader: false,
  delimitersToGuess: DEFAULT_DELIMITERS_TO_GUESS,
  chunkSize: 0, // Use default chunk sizes
} as const;

// Export mutable constants for legacy compatibility
export { PAPA_CONSTANTS as CONSTANTS };
// Constants for dynamic typing (from legacy lines 1031-1034)
export const MAX_FLOAT = Math.pow(2, 53);
export const MIN_FLOAT = -MAX_FLOAT;
export const FLOAT = /^\s*-?(\d+\.?|\.\d+|\d+\.\d+)([eE][-+]?\d+)?\s*$/;
export const ISO_DATE =
  /^((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)))$/;
