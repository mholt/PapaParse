/**
 * FileStreamer for processing File objects with FileReader and progress events.
 *
 * Handles browser File objects by reading them in chunks using FileReader API,
 * with support for both async and sync reading modes.
 *
 * Based on legacy implementation: lines 734-798
 */

import { CONSTANTS } from "../constants";
import { bindFunction } from "../utils";
import { ChunkStreamer, type ChunkStreamerConfig } from "./chunk-streamer";

export interface FileStreamerConfig extends ChunkStreamerConfig {
  encoding?: string;
}

declare const FileReader: any;
declare const FileReaderSync: any;

export class FileStreamer extends ChunkStreamer {
  private reader: any;
  private slice: any;
  private usingAsyncReader: boolean;

  constructor(config: FileStreamerConfig = {}) {
    // Set default chunk size for files if not specified
    if (!config.chunkSize) {
      config.chunkSize = CONSTANTS.LocalChunkSize;
    }

    super(config);

    // Check if FileReader is available and functional
    // Safari doesn't consider it a function - see issue #105
    this.usingAsyncReader = typeof FileReader !== "undefined";
  }

  /**
   * Start streaming from a File object.
   *
   * @param file The File object to read
   */
  stream(file: File): void {
    this._input = file;

    // Get the appropriate slice method (browser compatibility)
    this.slice = (file as any).slice || (file as any).webkitSlice || (file as any).mozSlice;

    if (this.usingAsyncReader) {
      // Preferred method of reading files, even in workers
      this.reader = new FileReader();
      this.reader.onload = bindFunction(this._chunkLoaded, this);
      this.reader.onerror = bindFunction(this._chunkError, this);
    } else {
      // Hack for running in a web worker in Firefox
      this.reader = new FileReaderSync();
    }

    this._nextChunk(); // Start streaming
  }

  /**
   * Process the next chunk if conditions are met.
   */
  protected _nextChunk(): void {
    if (!this._finished && (!this._config.preview || this._rowCount < this._config.preview)) {
      this._readChunk();
    }
  }

  /**
   * Read the next chunk from the file.
   */
  private _readChunk(): void {
    const input = this._input;
    let fileSlice = input;

    if (this._config.chunkSize && this._config.chunkSize > 0) {
      const end = Math.min(this._start + this._config.chunkSize, input.size);
      fileSlice = this.slice.call(input, this._start, end);
    }

    const encoding = (this._config as FileStreamerConfig).encoding;
    const txt = this.reader.readAsText(fileSlice, encoding);

    if (!this.usingAsyncReader) {
      // Synchronous reader - mimic async signature
      this._chunkLoaded({ target: { result: txt } });
    }
  }

  /**
   * Handle successful chunk loading.
   */
  private _chunkLoaded(event: any): void {
    // Very important to increment start each time before handling results
    this._start += this._config.chunkSize || 0;

    // Check if we've reached the end of the file
    this._finished = !this._config.chunkSize || this._start >= (this._input as File).size;

    this.parseChunk(event.target.result);
  }

  /**
   * Handle file reading errors.
   */
  private _chunkError(): void {
    this._sendError(this.reader.error);
  }

  /**
   * Get the current progress of file reading (0-1).
   */
  getProgress(): number {
    if (!this._input) return 0;
    const file = this._input as File;
    return file.size > 0 ? this._start / file.size : 1;
  }

  /**
   * Get the total size of the file being processed.
   */
  getTotalSize(): number {
    return this._input ? (this._input as File).size : 0;
  }

  /**
   * Get the current position in the file.
   */
  getCurrentPosition(): number {
    return this._start;
  }

  /**
   * Override pause to handle file-specific pausing logic.
   */
  pause(): void {
    super.pause();
    // For files, the FileReader operations are async so we rely on
    // the base class halted state to prevent further processing
  }

  /**
   * Override resume to continue processing file chunks.
   */
  resume(): void {
    super.resume();
    // Continue with next chunk if not finished and not halted
    if (!this._finished && !this._halted) {
      this._nextChunk();
    }
  }
}
