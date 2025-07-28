/**
 * NetworkStreamer for downloading and processing remote files via HTTP.
 *
 * Handles remote file downloading with XMLHttpRequest, supporting range requests
 * for chunked downloading, custom headers, credentials, and POST requests.
 *
 * Based on legacy implementation: lines 617-731
 */

import { ChunkStreamer, ChunkStreamerConfig } from "./chunk-streamer";
import { bindFunction } from "../utils";
import { CONSTANTS } from "../constants";

export interface NetworkStreamerConfig extends ChunkStreamerConfig {
  withCredentials?: boolean;
  downloadRequestHeaders?: { [key: string]: string };
  downloadRequestBody?: string;
}

declare const IS_WORKER: boolean;

export class NetworkStreamer extends ChunkStreamer {
  private xhr: XMLHttpRequest | null = null;

  constructor(config: NetworkStreamerConfig = {}) {
    // Set default chunk size for remote files if not specified
    if (!config.chunkSize) {
      config.chunkSize = CONSTANTS.RemoteChunkSize;
    }

    super(config);
  }

  /**
   * Start streaming from a remote URL.
   *
   * @param url The URL to download and parse
   */
  stream(url: string): void {
    this._input = url;
    this._nextChunk(); // Start streaming
  }

  /**
   * Process the next chunk based on environment (worker vs main thread).
   */
  protected _nextChunk(): void {
    if (typeof IS_WORKER !== "undefined" && IS_WORKER) {
      // In worker environment, handle both read and load in sequence
      this._readChunk();
      this._chunkLoaded();
    } else {
      // In main thread, let async handlers manage the flow
      this._readChunk();
    }
  }

  /**
   * Read the next chunk via XMLHttpRequest.
   */
  private _readChunk(): void {
    if (this._finished) {
      this._chunkLoaded();
      return;
    }

    this.xhr = new XMLHttpRequest();

    // Configure credentials if specified
    if ((this._config as NetworkStreamerConfig).withCredentials) {
      this.xhr.withCredentials = true;
    }

    // Set up event handlers for main thread (not needed in worker)
    if (typeof IS_WORKER === "undefined" || !IS_WORKER) {
      this.xhr.onload = bindFunction(this._chunkLoaded, this);
      this.xhr.onerror = () => this._chunkError();
    }

    // Configure request method based on whether we have a request body
    const method = (this._config as NetworkStreamerConfig).downloadRequestBody
      ? "POST"
      : "GET";
    const isAsync = typeof IS_WORKER === "undefined" || !IS_WORKER;

    this.xhr.open(method, this._input as string, isAsync);

    // Set custom headers if specified
    const headers = (this._config as NetworkStreamerConfig)
      .downloadRequestHeaders;
    if (headers) {
      for (const headerName in headers) {
        this.xhr.setRequestHeader(headerName, headers[headerName]);
      }
    }

    // Set range header for chunked downloading
    if (this._config.chunkSize && this._config.chunkSize > 0) {
      const end = this._start + this._config.chunkSize - 1; // minus one because byte range is inclusive
      this.xhr.setRequestHeader("Range", `bytes=${this._start}-${end}`);
    }

    try {
      const requestBody = (this._config as NetworkStreamerConfig)
        .downloadRequestBody;
      this.xhr.send(requestBody);
    } catch (err: any) {
      this._chunkError(err.message);
    }

    // Handle worker-specific error case
    if (
      typeof IS_WORKER !== "undefined" &&
      IS_WORKER &&
      this.xhr.status === 0
    ) {
      this._chunkError();
    }
  }

  /**
   * Handle successful chunk loading.
   */
  private _chunkLoaded(): void {
    if (!this.xhr || this.xhr.readyState !== 4) {
      return;
    }

    if (this.xhr.status < 200 || this.xhr.status >= 400) {
      this._chunkError();
      return;
    }

    // Use chunkSize as it may be different from response length due to characters with more than 1 byte
    this._start += this._config.chunkSize || this.xhr.responseText.length;
    this._finished =
      !this._config.chunkSize || this._start >= this.getFileSize(this.xhr);

    this.parseChunk(this.xhr.responseText);
  }

  /**
   * Handle network or HTTP errors.
   */
  private _chunkError(errorMessage?: string): void {
    const errorText = this.xhr
      ? this.xhr.statusText
      : errorMessage || "Network error";
    this._sendError(new Error(errorText));
  }

  /**
   * Send error through the configured error handler.
   */
  private _sendError(error: Error): void {
    if (typeof this._config.error === "function") {
      this._config.error(error);
    }
    // Worker error handling is managed in the base ChunkStreamer
  }

  /**
   * Extract file size from Content-Range header.
   */
  private getFileSize(xhr: XMLHttpRequest): number {
    const contentRange = xhr.getResponseHeader("Content-Range");
    if (contentRange === null) {
      // No content range, then finish!
      return -1;
    }
    return parseInt(contentRange.substring(contentRange.lastIndexOf("/") + 1));
  }

  /**
   * Get the current progress of the download (0-1).
   * Returns -1 if content length is unknown.
   */
  getProgress(): number {
    if (!this.xhr) return 0;

    const totalSize = this.getFileSize(this.xhr);
    if (totalSize <= 0) return -1; // Unknown content length

    return this._start / totalSize;
  }

  /**
   * Get the total size of the remote file.
   * Returns -1 if content length is unknown.
   */
  getTotalSize(): number {
    return this.xhr ? this.getFileSize(this.xhr) : -1;
  }

  /**
   * Get the current download position.
   */
  getCurrentPosition(): number {
    return this._start;
  }

  /**
   * Abort the current network request.
   */
  abort(): void {
    if (this.xhr) {
      this.xhr.abort();
    }
    super.abort();
  }

  /**
   * Get the current XMLHttpRequest instance.
   */
  getXHR(): XMLHttpRequest | null {
    return this.xhr;
  }
}
