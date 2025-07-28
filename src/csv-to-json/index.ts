/**
 * CSV to JSON Parsing - Main parsing function with input type detection
 *
 * This module implements the primary CsvToJson function from the legacy codebase,
 * providing input type detection, worker coordination, and streamer selection.
 * Based on legacy lines 196-257.
 */

import type { PapaParseConfig, PapaParseResult } from "../types";
import { isFunction, stripBom } from "../utils";
import { newWorker } from "../workers/host";
import {
  StringStreamer,
  FileStreamer,
  NetworkStreamer,
  ReadableStreamStreamer,
  DuplexStreamStreamer,
} from "../streamers";
import { CONSTANTS } from "../constants";

/**
 * Type for Papa.NODE_STREAM_INPUT symbol
 * This matches the legacy behavior exactly
 */
declare const NODE_STREAM_INPUT: unique symbol;

/**
 * Global detection for browser vs Node.js context
 * This matches the legacy PAPA_BROWSER_CONTEXT detection
 */
declare const PAPA_BROWSER_CONTEXT: boolean | undefined;

/**
 * Global detection for Web Worker support
 * This matches the legacy Papa.WORKERS_SUPPORTED
 */
declare const WORKERS_SUPPORTED: boolean;

/**
 * Node.js readable stream detection interface
 * Matches legacy detection logic
 */
interface NodeReadableStream {
  readable: boolean;
  read: Function;
  on: Function;
}

/**
 * Main CSV to JSON parsing function
 *
 * Handles input type detection, worker coordination, and streamer selection.
 * Maintains exact legacy behavior and API compatibility.
 *
 * @param input - Input data (string, File, stream, or NODE_STREAM_INPUT)
 * @param config - Parse configuration options
 * @returns Parse result, void (for workers/async), or stream (for Node.js duplex)
 */
export function CsvToJson<T = any>(
  input: any,
  config?: PapaParseConfig<T>,
): PapaParseResult<T> | void | any {
  // Default empty config to match legacy behavior
  const _config = config || {};

  // Handle dynamic typing configuration exactly like legacy
  let dynamicTyping = _config.dynamicTyping || false;
  if (isFunction(dynamicTyping)) {
    (_config as any).dynamicTypingFunction = dynamicTyping;
    // Will be filled on first row call - matches legacy comment
    dynamicTyping = {};
  }
  (_config as any).dynamicTyping = dynamicTyping;

  // Handle transform function exactly like legacy
  (_config as any).transform = isFunction(_config.transform)
    ? _config.transform
    : false;

  // Worker handling - matches legacy lines 209-231
  if (_config.worker && WORKERS_SUPPORTED) {
    const w = newWorker();

    // Store user callbacks on worker instance
    (w as any).userStep = _config.step;
    (w as any).userChunk = _config.chunk;
    (w as any).userComplete = _config.complete;
    (w as any).userError = _config.error;

    // Convert callback functions to boolean flags for worker message
    (_config as any).step = isFunction(_config.step);
    (_config as any).chunk = isFunction(_config.chunk);
    (_config as any).complete = isFunction(_config.complete);
    (_config as any).error = isFunction(_config.error);

    // Prevent infinite loop by removing worker flag
    delete (_config as any).worker;

    // Send work to worker thread
    w.postMessage({
      input: input,
      config: _config,
      workerId: (w as any).id,
    });

    return; // Void return for worker case
  }

  // Streamer selection and input type detection
  let streamer = null;

  // Node.js duplex stream case - matches legacy lines 234-240
  if (
    input === (NODE_STREAM_INPUT as any) &&
    typeof PAPA_BROWSER_CONTEXT === "undefined"
  ) {
    // Create a Node.js Duplex stream for use with .pipe
    streamer = new DuplexStreamStreamer(_config as any);
    return streamer.getStream();
  }
  // String input case - matches legacy lines 241-248
  else if (typeof input === "string") {
    const strippedInput = stripBom(input);
    if (_config.download) {
      streamer = new NetworkStreamer(_config as any);
    } else {
      streamer = new StringStreamer(_config as any);
    }
    return streamer.stream(strippedInput);
  }
  // Node.js readable stream case - matches legacy lines 249-252
  else if (
    (input as NodeReadableStream).readable === true &&
    isFunction((input as NodeReadableStream).read) &&
    isFunction((input as NodeReadableStream).on)
  ) {
    streamer = new ReadableStreamStreamer(_config as any);
    return streamer.stream(input);
  }
  // File or object case - matches legacy lines 253-254
  else if (
    (typeof File !== "undefined" && input instanceof File) ||
    input instanceof Object
  ) {
    // Safari compatibility - see legacy comment about issue #106
    streamer = new FileStreamer(_config as any);
    return streamer.stream(input);
  }

  // If no streamer was selected, this is an error condition
  // The legacy code would reach line 256 and attempt to call stream on null
  throw new Error("Unable to determine input type for parsing");
}
