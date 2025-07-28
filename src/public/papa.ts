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
import { ParserHandle } from "../core/parser-handle";
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
  WORKERS_SUPPORTED: boolean;
  NODE_STREAM_INPUT: number;
  LocalChunkSize: number;
  RemoteChunkSize: number;
  DefaultDelimiter: string;

  // Worker management
  WORKER_ID?: number;

  // Legacy classes exposed for testing
  Parser: typeof Parser;
  ParserHandle: typeof ParserHandle;
  ChunkStreamer: typeof ChunkStreamer;
  StringStreamer: typeof StringStreamer;
  FileStreamer: typeof FileStreamer;
  NetworkStreamer: typeof NetworkStreamer;
  ReadableStreamStreamer: typeof ReadableStreamStreamer;
  DuplexStreamStreamer?: typeof DuplexStreamStreamer; // Conditional for browser context
}

/**
 * Environment detection matching legacy behavior
 */
function detectEnvironment() {
  // Global object detection (matching legacy/papaparse.js lines 35-46)
  const global = (function () {
    if (typeof self !== "undefined") {
      return self;
    }
    if (typeof window !== "undefined") {
      return window;
    }
    if (typeof globalThis !== "undefined") {
      return globalThis;
    }
    // When running tests none of the above have been defined
    return {};
  })() as any;

  const IS_WORKER = !global.document && !!global.postMessage;
  const WORKERS_SUPPORTED = !IS_WORKER && !!global.Worker;

  return { global, IS_WORKER, WORKERS_SUPPORTED };
}

/**
 * Create Papa object with legacy compatibility
 * Using Object.assign pattern to maintain exact API surface
 */
export function createPapaObject(): PapaObject {
  const { WORKERS_SUPPORTED } = detectEnvironment();

  const Papa: PapaObject = {
    // Main API functions
    parse: CsvToJson,
    unparse: JsonToCsv,

    // Constants (spread to maintain mutability)
    ...CONSTANTS,

    // Environment-specific properties (matching legacy)
    WORKERS_SUPPORTED,
    NODE_STREAM_INPUT: 1,

    // Legacy classes for testing
    Parser,
    ParserHandle,
    ChunkStreamer,
    StringStreamer,
    FileStreamer,
    NetworkStreamer,
    ReadableStreamStreamer,
  };

  // Conditionally add DuplexStreamStreamer (matching legacy line 84-86)
  if (typeof (globalThis as any).PAPA_BROWSER_CONTEXT === "undefined") {
    Papa.DuplexStreamStreamer = DuplexStreamStreamer;
  }

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
