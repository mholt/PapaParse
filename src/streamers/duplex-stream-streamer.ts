/**
 * DuplexStreamStreamer for Node.js duplex stream processing.
 *
 * Creates a duplex stream that can be used for piping CSV data through,
 * with proper backpressure handling and Node.js streaming conventions.
 *
 * Based on legacy implementation: lines 926-1024
 */

import { ChunkStreamer, ChunkStreamerConfig } from "./chunk-streamer";
import { bindFunction, copy, isFunction } from "../utils";

// Type declarations for Node.js streams
declare const require: any;

export interface DuplexStreamStreamerConfig extends ChunkStreamerConfig {
  encoding?: string;
}

export interface NodeDuplex {
  push(chunk: any): boolean;
  once(event: string, callback: () => void): void;
}

export class DuplexStreamStreamer extends ChunkStreamer {
  private parseOnWrite = true;
  private writeStreamHasFinished = false;
  private parseCallbackQueue: (() => void)[] = [];
  private duplexStream: NodeDuplex | null = null;
  private Duplex: any;

  constructor(_config: DuplexStreamStreamerConfig) {
    const config = copy(_config);

    // Call super first before using this
    super(config);

    // Get Node.js Duplex stream class
    if (typeof require === "undefined") {
      throw new Error(
        "DuplexStreamStreamer is only available in Node.js environment",
      );
    }
    const { Duplex } = require("stream");

    // Set up callbacks for CSV processing
    this._config.step = bindFunction(this._onCsvData, this);
    this._config.complete = bindFunction(this._onCsvComplete, this);

    this.Duplex = Duplex;
    this._createStream();
  }

  /**
   * Handle CSV data results by pushing to the readable side.
   */
  private _onCsvData = (results: any): void => {
    const data = results.data;

    if (
      !this.duplexStream!.push(data) &&
      this._handle &&
      !this._handle.paused()
    ) {
      // The writable consumer buffer has filled up,
      // so we need to pause until more items can be processed
      this._handle.pause();
    }
  };

  /**
   * Handle CSV parsing completion by ending the readable stream.
   */
  private _onCsvComplete = (): void => {
    // Node will finish the read stream when null is pushed
    this.duplexStream!.push(null);
  };

  /**
   * Process the next chunk from the callback queue.
   */
  protected _nextChunk(): void {
    if (this.writeStreamHasFinished && this.parseCallbackQueue.length === 1) {
      this._finished = true;
    }

    if (this.parseCallbackQueue.length > 0) {
      const callback = this.parseCallbackQueue.shift()!;
      callback();
    } else {
      this.parseOnWrite = true;
    }
  }

  /**
   * Add a chunk to the parse queue with callback for flow control.
   */
  private _addToParseQueue(chunk: any, callback?: () => void): void {
    // Add to queue so that we can indicate completion via callback.
    // Node will automatically pause the incoming stream when too many
    // items have been added without their callback being invoked.
    this.parseCallbackQueue.push(
      bindFunction(() => {
        const stringChunk =
          typeof chunk === "string"
            ? chunk
            : chunk.toString(
                (this._config as DuplexStreamStreamerConfig).encoding,
              );

        this.parseChunk(stringChunk);

        if (isFunction(callback)) {
          return callback();
        }
      }, this),
    );

    if (this.parseOnWrite) {
      this.parseOnWrite = false;
      this._nextChunk();
    }
  }

  /**
   * Handle read requests from the readable side.
   */
  private _onRead(): void {
    if (this._handle && this._handle.paused()) {
      // The writable consumer can handle more data,
      // so resume the chunk parsing
      this._handle.resume();
    }
  }

  /**
   * Handle writes to the writable side.
   */
  private _onWrite(chunk: any, encoding: string, callback: () => void): void {
    this._addToParseQueue(chunk, callback);
  }

  /**
   * Handle completion of writing.
   */
  private _onWriteComplete(): void {
    this.writeStreamHasFinished = true;
    // Have to write empty string so parser knows it's done
    this._addToParseQueue("");
  }

  /**
   * Create the internal duplex stream.
   */
  private _createStream(): void {
    this.duplexStream = new this.Duplex({
      readableObjectMode: true,
      decodeStrings: false,
      read: bindFunction(this._onRead, this),
      write: bindFunction(this._onWrite, this),
    });

    this.duplexStream!.once(
      "finish",
      bindFunction(this._onWriteComplete, this),
    );
  }

  /**
   * Get the duplex stream for piping.
   */
  getStream(): NodeDuplex | null {
    return this.duplexStream;
  }

  /**
   * Get the number of callbacks currently queued.
   */
  getQueueLength(): number {
    return this.parseCallbackQueue.length;
  }

  /**
   * Check if the write stream has finished.
   */
  hasWriteStreamFinished(): boolean {
    return this.writeStreamHasFinished;
  }

  /**
   * Check if currently parsing on write (not waiting for more chunks).
   */
  isParsingOnWrite(): boolean {
    return !this.parseOnWrite;
  }

  /**
   * Override abort to handle duplex stream cleanup.
   */
  abort(): void {
    if (this.duplexStream) {
      // Clean up the stream
      this.parseCallbackQueue.length = 0;
      this.writeStreamHasFinished = true;
    }
    super.abort();
  }

  /**
   * Override pause to handle duplex stream pausing.
   */
  pause(): void {
    super.pause();
    // The duplex stream handles its own pausing through backpressure
  }

  /**
   * Override resume to handle duplex stream resuming.
   */
  resume(): void {
    super.resume();
    // Continue processing if we have queued callbacks
    if (
      !this._finished &&
      !this._halted &&
      this.parseCallbackQueue.length > 0
    ) {
      this._nextChunk();
    }
  }
}
