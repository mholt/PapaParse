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

  constructor(_config: DuplexStreamStreamerConfig) {
    // Get Node.js Duplex stream class
    if (typeof require === "undefined") {
      throw new Error(
        "DuplexStreamStreamer is only available in Node.js environment",
      );
    }
    const { Duplex } = require("stream");

    const config = copy(_config);

    // The legacy implementation sets up these callbacks before calling the parent constructor
    // We need to defer the binding until after super() is called
    const originalStep = config.step;
    const originalComplete = config.complete;

    // Set up the actual callbacks that will be used
    let duplexInstance: DuplexStreamStreamer | null = null;

    config.step = function (results: any, parser?: any) {
      if (duplexInstance) {
        duplexInstance._onCsvData(results, parser);
      }
    };

    config.complete = function (results?: any) {
      if (duplexInstance) {
        duplexInstance._onCsvComplete();
      }
    };

    super(config);

    // Now set the instance reference
    duplexInstance = this;

    // Create the duplex stream
    this.duplexStream = new Duplex({
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
   * Handle CSV data results by pushing to the readable side.
   */
  private _onCsvData = (results: any, parser?: any): void => {
    const data = results.data;

    // In legacy, this is called for each row when step is configured
    if (!this.duplexStream!.push(data) && !this._handle.paused()) {
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

    if (this.parseCallbackQueue.length) {
      this.parseCallbackQueue.shift()!();
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
            : chunk.toString(this._config.encoding);

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
  private _onRead = (): void => {
    if (this._handle.paused()) {
      // The writable consumer can handle more data,
      // so resume the chunk parsing
      this._handle.resume();
    }
  };

  /**
   * Handle writes to the writable side.
   */
  private _onWrite = (
    chunk: any,
    encoding: string,
    callback: () => void,
  ): void => {
    this._addToParseQueue(chunk, callback);
  };

  /**
   * Handle completion of writing.
   */
  private _onWriteComplete = (): void => {
    this.writeStreamHasFinished = true;
    // Have to write empty string so parser knows it's done
    this._addToParseQueue("");
  };

  /**
   * Get the duplex stream for piping.
   */
  getStream(): NodeDuplex | null {
    return this.duplexStream;
  }

  /**
   * Override stream method - not used for duplex streams.
   * The duplex stream is created in the constructor.
   */
  stream(input?: any): any {
    // For DuplexStreamStreamer, the stream is created in constructor
    // and accessed via getStream() method
    return this.duplexStream;
  }
}
