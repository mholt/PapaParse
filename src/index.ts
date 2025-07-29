/**
 * PapaParse V6 - Modern TypeScript Implementation
 *
 * This is the main entry point for the new modular TypeScript implementation
 * of PapaParse. It maintains 100% API compatibility with the legacy version
 * while providing a modern, maintainable codebase.
 *
 * Phase 8: PUBLIC API & COMPATIBILITY - COMPLETE ✅
 */

// Re-export all public APIs for modular usage (selective to avoid conflicts)
export {
  BAD_DELIMITERS_WITH_BOM,
  CONSTANTS,
  DEFAULT_CONFIG,
  DEFAULT_DELIMITERS_TO_GUESS,
  ERROR_CODES,
  ERROR_TYPES,
  NODE_STREAM_INPUT,
} from "./constants";
export { Parser } from "./core/parser";
export { ParserHandle } from "./core/parser-handle";
export {
  parseDynamic,
  shouldApplyDynamicTyping,
  transformField,
} from "./heuristics/dynamic-typing";
// Heuristics and algorithms
export { guessDelimiter } from "./heuristics/guess-delimiter";
export { guessLineEndings } from "./heuristics/line-endings";
// Core parsing functionality
export { CsvToJson } from "./methods/csv-to-json";
export { JsonToCsv } from "./methods/json-to-csv";
// Plugin system
export { autoRegisterJQueryPlugin, initializePlugins } from "./plugins";
export type { PapaObject } from "./public/papa";
// Main Papa object export
// Papa object construction
export { createPapaObject, Papa as default } from "./public/papa";
// Streaming infrastructure
export { ChunkStreamer } from "./streamers/chunk-streamer";
export { DuplexStreamStreamer } from "./streamers/duplex-stream-streamer";
export { FileStreamer } from "./streamers/file-streamer";
export { NetworkStreamer } from "./streamers/network-streamer";
export { ReadableStreamStreamer } from "./streamers/readable-stream-streamer";
export { StringStreamer } from "./streamers/string-streamer";
export * from "./types";
export * from "./utils";
// Workers
export {
  newWorker,
  sendWorkToWorker,
  terminateAllWorkers,
  workersSupported,
} from "./workers/host";

/**
 * Development Status:
 *
 * ✅ Phase 1: Foundation & Performance Infrastructure - COMPLETE
 * ✅ Phase 2: Core Parsing Engine - COMPLETE
 * ✅ Phase 3: Heuristics & Algorithms - COMPLETE
 * ✅ Phase 4: Streaming Infrastructure - COMPLETE
 * ✅ Phase 5: Core Functions - COMPLETE
 * ✅ Phase 6: Workers & Concurrency - COMPLETE
 * ✅ Phase 7: Plugin System - COMPLETE
 * ✅ Phase 8: Public API & Compatibility - COMPLETE
 *
 * 🎉 ALL PHASES COMPLETE - Modern TypeScript implementation ready!
 *
 * Ready for:
 * - API compatibility verification
 * - Complete test suite validation
 * - Performance regression testing
 * - Integration testing
 */
