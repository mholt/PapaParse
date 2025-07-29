/**
 * Base ChunkStreamer class for various streamer implementations.
 *
 * This serves as the coordination layer between different input sources
 * (strings, files, network, streams) and the parser engine.
 *
 * Based on legacy implementation: lines 487-563
 */

import { PapaParseConfig, PapaParseResult, PapaParseError } from "../types";
import { ParserHandle } from "../core/parser-handle";
import { isFunction } from "../utils";

export interface ChunkStreamerConfig extends PapaParseConfig {
  skipFirstNLines?: number;
}

declare const IS_PAPA_WORKER: boolean;
declare const Papa: any;
declare const global: any;

export class ChunkStreamer {
  protected _handle: ParserHandle;
  protected _finished = false;
  protected _completed = false;
  protected _halted = false;
  protected _input: any = null;
  protected _baseIndex = 0;
  protected _partialLine = "";
  protected _rowCount = 0;
  protected _start = 0;
  protected _nextChunk(): void {
    // Default implementation - to be overridden by subclasses
  }
  protected _config: ChunkStreamerConfig;

  public isFirstChunk = true;
  public _completeResults: PapaParseResult = {
    data: [],
    errors: [],
    meta: {
      delimiter: "",
      linebreak: "",
      aborted: false,
      truncated: false,
      cursor: 0,
    },
  };

  constructor(config: ChunkStreamerConfig) {
    // Deep-copy the config so we can edit it
    const configCopy = { ...config };
    configCopy.chunkSize = parseInt(String(configCopy.chunkSize)) || undefined;
    if (!config.step && !config.chunk) {
      configCopy.chunkSize = undefined; // disable Range header if not streaming; bad values break IIS - see issue #196
    }
    this._handle = new ParserHandle(configCopy);
    this._handle.streamer = this;
    this._config = configCopy; // persist the copy to the caller
  }

  /**
   * Parse a chunk of data and coordinate with the parser handle.
   * Handles first chunk preprocessing, partial line management, and result coordination.
   */
  parseChunk(chunk: string, isFakeChunk?: boolean): any {
    // First chunk pre-processing for line skipping
    const skipFirstNLines =
      parseInt(String(this._config.skipFirstNLines || 0)) || 0;
    if (this.isFirstChunk && skipFirstNLines > 0) {
      let _newline = this._config.newline;
      if (!_newline) {
        const quoteChar = this._config.quoteChar || '"';
        const guessed = this._handle.guessLineEndings(chunk, quoteChar);
        _newline = guessed as "\r" | "\n" | "\r\n" | undefined;
      }
      const splitChunk = chunk.split(_newline || "\n");
      chunk = [...splitChunk.slice(skipFirstNLines)].join(_newline || "\n");
    }

    // Allow first chunk modification
    if (this.isFirstChunk && isFunction(this._config.beforeFirstChunk)) {
      const modifiedChunk = this._config.beforeFirstChunk(chunk);
      if (modifiedChunk !== undefined) {
        chunk = modifiedChunk;
      }
    }

    this.isFirstChunk = false;
    this._halted = false;

    // Rejoin the line we likely just split in two by chunking the file
    const aggregate = this._partialLine + chunk;
    this._partialLine = "";

    // Pass current row count to parser handle for error row offset
    if ((this._handle as any).state) {
      (this._handle as any).state.rowCounter = this._rowCount;
    }

    let results = this._handle.parse(
      aggregate,
      this._baseIndex,
      !this._finished
    );

    if (this._handle.paused() || this._handle.aborted()) {
      this._halted = true;
      return;
    }

    const lastIndex = results.meta.cursor || 0;

    if (!this._finished) {
      this._partialLine = aggregate.substring(lastIndex - this._baseIndex);
      this._baseIndex = lastIndex;
    }

    if (results && results.data) {
      this._rowCount += results.data.length;
    }

    const finishedIncludingPreview =
      this._finished ||
      (this._config.preview && this._rowCount >= this._config.preview);

    // Worker coordination
    if (typeof IS_PAPA_WORKER !== "undefined" && IS_PAPA_WORKER) {
      if (typeof global !== "undefined" && global.postMessage) {
        global.postMessage({
          results: results,
          workerId: Papa.WORKER_ID,
          finished: finishedIncludingPreview,
        });
      }
    } else if (isFunction(this._config.chunk) && !isFakeChunk) {
      this._config.chunk(results, this._handle);
      if (this._handle?.paused() || this._handle?.aborted()) {
        this._halted = true;
        return;
      }
      results = undefined as any;
      this._completeResults = undefined as any;
    }

    // Accumulate results when not using step or chunk callbacks
    if (!this._config.step && !this._config.chunk) {
      this._completeResults.data = this._completeResults.data.concat(
        results.data
      );
      this._completeResults.errors = this._completeResults.errors.concat(
        results.errors
      );
      this._completeResults.meta = results.meta;
    }

    if (
      !this._completed &&
      finishedIncludingPreview &&
      isFunction(this._config.complete) &&
      (!results || !results.meta.aborted)
    ) {
      this._config.complete(this._completeResults);
      this._completed = true;
    }

    // Continue streaming unless we are finished or currently paused (legacy lines 583-585)
    if (
      !finishedIncludingPreview &&
      (!results || !(results.meta as any).paused)
    ) {
      this._nextChunk();
    }

    return results;
  }

  /**
   * Initialize the streamer with a parser handle.
   */
  setHandle(handle: ParserHandle): void {
    this._handle = handle;
  }

  /**
   * Get the current parser handle.
   */
  getHandle(): ParserHandle {
    return this._handle;
  }

  /**
   * Check if the streamer is finished processing.
   */
  finished(): boolean {
    return this._finished;
  }

  /**
   * Check if the streamer is completed (including callbacks).
   */
  completed(): boolean {
    return this._completed;
  }

  /**
   * Check if the streamer is halted (paused or aborted).
   */
  halted(): boolean {
    return this._halted;
  }

  /**
   * Get the current row count.
   */
  getRowCount(): number {
    return this._rowCount;
  }

  /**
   * Get the complete results object.
   */
  getCompleteResults(): PapaParseResult {
    return this._completeResults;
  }

  /**
   * Mark the streaming as finished.
   * Note: In the current implementation, the complete callback is handled
   * directly in parseChunk() to match legacy behavior.
   */
  protected finish(): void {
    this._finished = true;
  }

  /**
   * Abstract method for starting the streaming process.
   * Must be implemented by concrete streamer classes.
   */
  stream(input?: any): any {
    throw new Error(
      "stream() method must be implemented by concrete streamer classes"
    );
  }

  /**
   * Pause the streaming process.
   */
  pause(): void {
    if (this._handle) {
      this._handle.pause();
    }
  }

  /**
   * Resume the streaming process.
   */
  resume(): void {
    if (this._handle) {
      this._handle.resume();
    }
  }

  /**
   * Abort the streaming process.
   */
  abort(): void {
    if (this._handle) {
      this._handle.abort();
    }
  }

  /**
   * Send error through the configured error handler or to worker.
   * Legacy implementation: lines 589-601
   */
  protected _sendError(error: Error | PapaParseError): void {
    if (isFunction(this._config.error)) {
      this._config.error(error);
    } else if (
      typeof IS_PAPA_WORKER !== "undefined" &&
      IS_PAPA_WORKER &&
      this._config.error
    ) {
      if (typeof global !== "undefined" && global.postMessage) {
        global.postMessage({
          workerId: Papa.WORKER_ID,
          error: error,
          finished: false,
        });
      }
    }
  }
}
