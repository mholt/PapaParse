/**
 * Papa Public API Object
 * Static property bag pattern preservation with legacy compatibility
 */

import { CsvToJson } from "../csv-to-json";
import { JsonToCsv } from "../json-to-csv";
import { CONSTANTS } from "../constants";
import { initializePlugins, autoRegisterJQueryPlugin } from "../plugins";
import type {
  PapaParseConfig,
  PapaParseResult,
  PapaParseParser,
} from "../types";

// Legacy classes exposed for testing (maintaining exact API)
import { Parser } from "../core/parser";
import { ChunkStreamer } from "../streamers/chunk-streamer";
import { StringStreamer } from "../streamers/string-streamer";
import { FileStreamer } from "../streamers/file-streamer";
import { NetworkStreamer } from "../streamers/network-streamer";
import { ReadableStreamStreamer } from "../streamers/readable-stream-streamer";
import { DuplexStreamStreamer } from "../streamers/duplex-stream-streamer";

/**
 * Papa object interface matching legacy API exactly
 */
export interface PapaObject {
  // Main API functions
  parse(
    input: string | File | any,
    config?: PapaParseConfig,
  ): PapaParseResult | PapaParseParser;
  unparse(data: any, config?: any): string;

  // Constants (runtime-mutable for legacy compatibility)
  RECORD_SEP: string;
  UNIT_SEP: string;
  BYTE_ORDER_MARK: string;
  BAD_DELIMITERS: string[];
  LocalChunkSize: number;
  RemoteChunkSize: number;
  DefaultDelimiter: string;

  // Worker management
  WORKER_ID?: number;

  // Legacy classes exposed for testing
  Parser: typeof Parser;
  ChunkStreamer: typeof ChunkStreamer;
  StringStreamer: typeof StringStreamer;
  FileStreamer: typeof FileStreamer;
  NetworkStreamer: typeof NetworkStreamer;
  ReadableStreamStreamer: typeof ReadableStreamStreamer;
  DuplexStreamStreamer: typeof DuplexStreamStreamer;
}

/**
 * Create Papa object with legacy compatibility
 * Using Object.assign pattern to maintain exact API surface
 */
export function createPapaObject(): PapaObject {
  const Papa: PapaObject = {
    // Main API functions
    parse: CsvToJson,
    unparse: JsonToCsv,

    // Constants (spread to maintain mutability)
    ...CONSTANTS,

    // Legacy classes for testing
    Parser,
    ChunkStreamer,
    StringStreamer,
    FileStreamer,
    NetworkStreamer,
    ReadableStreamStreamer,
    DuplexStreamStreamer,
  };

  // Initialize plugins after Papa object creation
  initializePlugins(Papa);

  // Auto-register jQuery plugin for backward compatibility
  autoRegisterJQueryPlugin(Papa);

  return Papa;
}

/**
 * Singleton Papa instance for consistent API
 */
export const Papa = createPapaObject();

export default Papa;
