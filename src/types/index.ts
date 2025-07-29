/**
 * Legacy PapaParse Type Definitions
 *
 * These types preserve the exact public API contract from the legacy implementation.
 * They maintain compatibility while providing TypeScript support.
 * Based on @types/papaparse but extended for exact legacy compatibility.
 */

/// <reference types="node" />

// Import Node types for compatibility
import type { Duplex } from "stream";

// Error object structure - expanded for modern implementation
export interface PapaParseError {
  /** A generalization of the error */
  type:
    | "Quotes"
    | "Delimiter"
    | "FieldMismatch"
    | "Network"
    | "File"
    | "Worker"
    | "Config"
    | "Parse";
  /** Standardized error code */
  code:
    | "MissingQuotes"
    | "UndetectableDelimiter"
    | "TooFewFields"
    | "TooManyFields"
    | "InvalidQuotes"
    | "InvalidDelimiter"
    | "NetworkError"
    | "DownloadError"
    | "FileSizeError"
    | "FileReadError"
    | "WorkerError"
    | "ConfigError"
    | "ParseError";
  /** Human-readable details */
  message: string;
  /** Row index of parsed data where error is */
  row?: number;
  /** Index within the row where error is */
  index?: number;
  /** Additional error details */
  details?: any;
}

// Meta information structure
export interface PapaParseMeta {
  /** Delimiter used */
  delimiter: string;
  /** Line break sequence used */
  linebreak: string;
  /** Whether process was aborted */
  aborted: boolean;
  /** Array of field names */
  fields?: string[];
  /** Whether preview consumed all input */
  truncated: boolean;
  /** Cursor position */
  cursor: number;
  /** Whether parsing is paused */
  paused?: boolean;
  /** Map of renamed headers (newName -> originalName) */
  renamedHeaders?: { [newHeader: string]: string } | null;
}

// Result structure for parsed data
export interface PapaParseResult<T = any> {
  /** Array of rows. If header is false, rows are arrays; otherwise they are objects */
  data: T[];
  /** Array of errors */
  errors: PapaParseError[];
  /** Extra information about the parse */
  meta: PapaParseMeta;
}

// Step result structure (single row)
export interface PapaParseStepResult<T = any> {
  /** In the step callback, the data array will only contain one element */
  data: T;
  /** Array of errors */
  errors: PapaParseError[];
  /** Extra information about the parse */
  meta: PapaParseMeta;
}

// Parser instance for step/chunk callbacks
export interface PapaParseParser {
  parse(
    input: string,
    baseIndex?: number,
    ignoreLastRow?: boolean,
  ): PapaParseResult;
  pause(): void;
  resume(): void;
  abort(): void;
  paused(): boolean;
  aborted(): boolean;
  getCharIndex(): number;
}

// File types
export type LocalFile = File | NodeJS.ReadableStream;

// Main configuration interface - EXACT legacy compatibility
export interface PapaParseConfig<T = any> {
  // String/Character Properties
  /** The delimiting character. Leave blank to auto-detect. Can be string or function. */
  delimiter?: string | ((input: string) => string);
  /** The newline sequence. Leave blank to auto-detect. Must be one of \r, \n, or \r\n. */
  newline?: "\r" | "\n" | "\r\n";
  /** The character used to quote fields. */
  quoteChar?: string;
  /** The character used to escape the quote character within a field. */
  escapeChar?: string;
  /** The encoding to use when opening local files. */
  encoding?: string;
  /** String that indicates a comment line to skip. */
  comments?: false | string;

  // Boolean Properties
  /** If true, the first row will be interpreted as field names. */
  header?: boolean;
  /** If true, numeric and boolean data will be converted to their type. */
  dynamicTyping?:
    | boolean
    | { [key: string]: boolean; [key: number]: boolean }
    | ((field: string | number) => boolean);
  /** Whether or not to use a worker thread. */
  worker?: boolean;
  /** Whether the string passed is actually a URL from which to download a file. */
  download?: boolean;
  /** A boolean value passed directly into XMLHttpRequest's "withCredentials" property. */
  withCredentials?: boolean;
  /** If true, lines that are completely empty will be skipped. */
  skipEmptyLines?: boolean | "greedy";
  /** Fast mode speeds up parsing significantly for large inputs. */
  fastMode?: boolean;

  // Numeric Properties
  /** If > 0, only that many rows will be parsed. */
  preview?: number;
  /** Overrides Papa.LocalChunkSize and Papa.RemoteChunkSize. */
  chunkSize?: number;
  /** To skip first N number of lines when converting a CSV file to JSON. */
  skipFirstNLines?: number;

  // Array Properties
  /** An array of delimiters to guess from if the delimiter option is not set. */
  delimitersToGuess?: string[];

  // Function Properties
  /** A function to execute for each parsed row. */
  step?: (results: PapaParseStepResult<T>, parser: PapaParseParser) => void;
  /** A callback function identical to step, executed after every chunk. */
  chunk?: (results: PapaParseResult<T>, parser: PapaParseParser) => void;
  /** The callback to execute when parsing is complete. */
  complete?: (results: PapaParseResult<T>) => void;
  /** A callback to execute if FileReader encounters an error. */
  error?: (error: Error | PapaParseError, file?: File) => void;
  /** A function to apply on each value. */
  transform?: (value: string, field: string | number) => any;
  /** A function to apply on each header. */
  transformHeader?: (header: string, index: number) => string;
  /** A function to execute before parsing the first chunk. */
  beforeFirstChunk?: (chunk: string) => string | void;

  // Download-specific properties
  /** Object that describes the headers for downloading files. */
  downloadRequestHeaders?: { [key: string]: string };
  /** Use POST request on the URL. The value passed will be set as the body. */
  downloadRequestBody?:
    | Blob
    | ArrayBuffer
    | FormData
    | URLSearchParams
    | string;

  // Internal properties (exposed for compatibility but not in public docs)
  dynamicTypingFunction?: (field: string | number) => boolean;
}

// Unparse (JSON to CSV) configuration - matching @types/papaparse
export interface PapaUnparseConfig {
  /** If true, forces all fields to be enclosed in quotes. */
  quotes?: boolean | boolean[] | ((value: any, columnIndex: number) => boolean);
  /** The character used to quote fields. */
  quoteChar?: string;
  /** The character used to escape quoteChar inside field values. */
  escapeChar?: string;
  /** The delimiting character. Multi-character delimiters are supported. */
  delimiter?: string;
  /** If false, will omit the header row. */
  header?: boolean;
  /** The character used to determine newline sequence. */
  newline?: string;
  /** If true, lines that are completely empty will be skipped. */
  skipEmptyLines?: boolean | "greedy";
  /** Manually specify the keys (columns) you expect in the objects. */
  columns?: string[];
  /** If true, field values that begin with =, +, -, or @ will be prepended with ' to defend against injection attacks. */
  escapeFormulae?: boolean | RegExp;
}

// Unparse data input types
export interface PapaUnparseObject<T> {
  fields: string[];
  data: T[];
}

export type PapaUnparseData<T = any> = T[][] | T[] | PapaUnparseObject<T>;

// Special constants and symbols
export declare const NODE_STREAM_INPUT: unique symbol;

// Main Papa object interface (for compatibility)
export interface PapaObject {
  // Core parsing functions
  parse<T = any>(
    input: string,
    config?: PapaParseConfig<T> & { download?: false; worker?: false },
  ): PapaParseResult<T>;
  parse<T = any>(
    input: string,
    config: PapaParseConfig<T> & { worker: true },
  ): void;
  parse<T = any>(
    input: string,
    config: PapaParseConfig<T> & { download: true },
  ): void;
  parse<T = any>(input: LocalFile, config: PapaParseConfig<T>): void;
  parse(stream: typeof NODE_STREAM_INPUT, config?: PapaParseConfig): Duplex;
  unparse<T = any>(
    data: PapaUnparseData<T>,
    config?: PapaUnparseConfig,
  ): string;

  // Read-only constants
  readonly RECORD_SEP: "\x1E";
  readonly UNIT_SEP: "\x1F";
  readonly BAD_DELIMITERS: readonly string[];
  readonly WORKERS_SUPPORTED: boolean;
  readonly NODE_STREAM_INPUT: typeof NODE_STREAM_INPUT;

  // Configurable properties (runtime-mutable for legacy compatibility)
  LocalChunkSize: number; // mutable!
  RemoteChunkSize: number; // mutable!
  DefaultDelimiter: string;

  // Exposed internal classes (for testing and development)
  Parser: any;
  ParserHandle: any;
  NetworkStreamer: any;
  FileStreamer: any;
  StringStreamer: any;
  ReadableStreamStreamer: any;
  DuplexStreamStreamer?: any; // undefined in browser context
}

// Stricter internal types for development (not exported to public API)
export interface StrictParseConfig<
  T extends string | number | symbol = string,
> {
  delimiter: string;
  newline: string;
  quoteChar: string;
  escapeChar: string;
  header: boolean;
  dynamicTyping: boolean;
  transform: false | ((value: string, field: T) => any);
  preview: number;
  encoding: string;
  worker: boolean;
  comments: false | string;
  step: false | ((results: PapaParseResult, parser: PapaParseParser) => void);
  complete: false | ((results: PapaParseResult) => void);
  error: false | ((error: PapaParseError, file?: File) => void);
  download: boolean;
  downloadRequestHeaders: { [key: string]: string };
  downloadRequestBody: string;
  skipEmptyLines: boolean | "greedy";
  chunk: false | ((results: PapaParseResult, parser: PapaParseParser) => void);
  fastMode: boolean | undefined;
  beforeFirstChunk: false | ((chunk: string) => string);
  withCredentials: boolean;
  transformHeader: false | ((header: string, index: number) => string);
  delimitersToGuess: string[];
  chunkSize: number;
}

// Internal result types
export interface ParsedRow {
  data: any[];
  errors: PapaParseError[];
}

export interface ParserState {
  input: string;
  baseIndex: number;
  ignoreLastRow: boolean;
  cursor: number;
  paused: boolean;
  aborted: boolean;
}

// Stream-related interfaces
export interface ChunkStreamable {
  stream(chunk: string): void;
  getCharIndex(): number;
}

export interface StreamerConfig {
  chunkSize: number;
  step?: (results: PapaParseResult, parser: PapaParseParser) => void;
  chunk?: (results: PapaParseResult, parser: PapaParseParser) => void;
  complete?: (results: PapaParseResult) => void;
  error?: (error: PapaParseError | Error, file?: File) => void;
}
