/**
 * ReadableStreamStreamer for processing Node.js readable streams.
 *
 * Handles Node.js readable streams with proper backpressure management,
 * queue buffering, and event-driven processing.
 *
 * Based on legacy implementation: lines 832-923
 */

import { ChunkStreamer, ChunkStreamerConfig } from "./chunk-streamer";
import { bindFunction } from "../utils";

export interface ReadableStreamStreamerConfig extends ChunkStreamerConfig {
  encoding?: string;
}

// Type for Node.js readable streams
export interface NodeReadableStream {
  on(event: "data", listener: (chunk: any) => void): this;
  on(event: "end", listener: () => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  removeListener(event: "data", listener: (chunk: any) => void): this;
  removeListener(event: "end", listener: () => void): this;
  removeListener(event: "error", listener: (error: Error) => void): this;
  pause(): this;
  resume(): this;
}

export class ReadableStreamStreamer extends ChunkStreamer {
  private queue: string[] = [];
  private parseOnData = true;
  private streamHasEnded = false;
  private _streamData: (chunk: any) => void;
  private _streamEnd: () => void;
  private _streamError: (error: Error) => void;
  private _streamCleanUp: () => void;

  constructor(config: ReadableStreamStreamerConfig = {}) {
    super(config);

    // Bind event handlers to maintain context
    this._streamData = bindFunction(this.handleStreamData, this);
    this._streamEnd = bindFunction(this.handleStreamEnd, this);
    this._streamError = bindFunction(this.handleStreamError, this);
    this._streamCleanUp = bindFunction(this.handleStreamCleanUp, this);
  }

  /**
   * Override pause to also pause the underlying stream.
   */
  pause(): void {
    super.pause();
    if (this._input) {
      (this._input as NodeReadableStream).pause();
    }
  }

  /**
   * Override resume to also resume the underlying stream.
   */
  resume(): void {
    super.resume();
    if (this._input) {
      (this._input as NodeReadableStream).resume();
    }
  }

  /**
   * Start streaming from a Node.js readable stream.
   *
   * @param stream The readable stream to process
   */
  stream(stream: NodeReadableStream): void {
    this._input = stream;

    // Attach event listeners
    stream.on("data", this._streamData);
    stream.on("end", this._streamEnd);
    stream.on("error", this._streamError);
  }

  /**
   * Check if streaming is finished and update state accordingly.
   */
  protected _checkIsFinished(): void {
    if (this.streamHasEnded && this.queue.length === 1) {
      this._finished = true;
    }
  }

  /**
   * Process the next chunk from the queue.
   */
  protected _nextChunk(): void {
    this._checkIsFinished();

    if (this.queue.length > 0) {
      const chunk = this.queue.shift()!;
      this.parseChunk(chunk);
    } else {
      this.parseOnData = true;
    }
  }

  /**
   * Handle incoming data from the stream.
   */
  private handleStreamData = (chunk: any): void => {
    try {
      // Convert chunk to string using configured encoding
      const stringChunk =
        typeof chunk === "string"
          ? chunk
          : chunk.toString(
              (this._config as ReadableStreamStreamerConfig).encoding,
            );

      this.queue.push(stringChunk);

      if (this.parseOnData) {
        this.parseOnData = false;
        this.parseChunk(this.queue.shift()!);
      } else if (this.streamHasEnded && stringChunk === "") {
        // Special case: ensure we process the final empty chunk that signals end
        this._nextChunk();
      }
    } catch (error) {
      this.handleStreamError(error as Error);
    }
  };

  /**
   * Handle stream errors.
   */
  private handleStreamError = (error: Error): void => {
    this.handleStreamCleanUp();
    this._sendError(error);
  };

  /**
   * Handle stream end event.
   */
  private handleStreamEnd = (): void => {
    this.handleStreamCleanUp();
    this.streamHasEnded = true;
    // Push empty string to trigger final processing
    this.handleStreamData("");
  };

  /**
   * Clean up event listeners to prevent memory leaks.
   */
  private handleStreamCleanUp = (): void => {
    if (this._input) {
      const stream = this._input as NodeReadableStream;
      stream.removeListener("data", this._streamData);
      stream.removeListener("end", this._streamEnd);
      stream.removeListener("error", this._streamError);
    }
  };

  /**
   * Send error through the configured error handler.
   */
  private _sendError(error: Error): void {
    if (typeof this._config.error === "function") {
      this._config.error(error);
    }
  }

  /**
   * Get the number of chunks currently queued.
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Check if the stream has ended.
   */
  hasStreamEnded(): boolean {
    return this.streamHasEnded;
  }

  /**
   * Check if currently parsing data (not waiting for more chunks).
   */
  isParsingData(): boolean {
    return !this.parseOnData;
  }

  /**
   * Override parseChunk to properly control the flow when called from _nextChunk.
   * We need to prevent the base class from calling _nextChunk() again.
   */
  parseChunk(chunk: string, isFakeChunk?: boolean): any {
    // Call the base class implementation but prevent its auto-_nextChunk call
    // by temporarily modifying the parent class behavior.
    const originalNextChunk = this._nextChunk;
    let skipAutoNext = false;

    // If we're not waiting for data, this call came from our _nextChunk
    if (!this.parseOnData) {
      skipAutoNext = true;
      // Temporarily override _nextChunk to prevent the base class from calling it
      this._nextChunk = () => {
        // Restore the original and call it ourselves
        this._nextChunk = originalNextChunk;
        this._nextChunk();
      };
    }

    const results = super.parseChunk(chunk, isFakeChunk);

    // Restore the original _nextChunk if we modified it
    if (skipAutoNext) {
      this._nextChunk = originalNextChunk;
    }

    return results;
  }

  /**
   * Get the underlying Node.js stream.
   */
  getStream(): NodeReadableStream | null {
    return this._input as NodeReadableStream;
  }

  /**
   * Override abort to clean up the stream.
   */
  abort(): void {
    this.handleStreamCleanUp();
    super.abort();
  }
}
