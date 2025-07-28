/**
 * StringStreamer for processing string input with memory-efficient chunking.
 *
 * Handles large strings by breaking them into chunks to avoid memory issues
 * while maintaining parsing state across chunk boundaries.
 *
 * Based on legacy implementation: lines 801-830
 */

import { ChunkStreamer, ChunkStreamerConfig } from "./chunk-streamer";

export class StringStreamer extends ChunkStreamer {
  private remaining = "";

  constructor(config: ChunkStreamerConfig = {}) {
    super(config);
  }

  /**
   * Start streaming from a string input.
   *
   * @param input The string to parse
   * @returns The result of parsing the first chunk
   */
  stream(input: string): any {
    this.remaining = input;
    this._input = input;
    return this._nextChunk();
  }

  /**
   * Process the next chunk of the string.
   *
   * Respects the configured chunkSize to break large strings into manageable pieces.
   * If no chunkSize is configured, processes the entire string at once.
   */
  protected _nextChunk(): any {
    if (this._finished) return;

    const size = this._config.chunkSize;
    let chunk: string;

    if (size && size > 0) {
      // Process in chunks for memory efficiency
      chunk = this.remaining.substring(0, size);
      this.remaining = this.remaining.substring(size);
    } else {
      // Process entire string at once
      chunk = this.remaining;
      this.remaining = "";
    }

    // Mark as finished when no more data remains
    this._finished = !this.remaining;

    return this.parseChunk(chunk);
  }

  /**
   * Override pause to handle string-specific pausing logic.
   */
  pause(): void {
    super.pause();
    // For strings, we don't need additional pause logic since we control the chunking
  }

  /**
   * Override resume to continue processing chunks.
   */
  resume(): void {
    super.resume();
    // Continue with next chunk if not finished and not halted
    if (!this._finished && !this._halted) {
      this._nextChunk();
    }
  }

  /**
   * Get the remaining unprocessed portion of the string.
   */
  getRemainingData(): string {
    return this.remaining;
  }

  /**
   * Get the progress of string processing (0-1).
   */
  getProgress(): number {
    if (!this._input) return 0;
    const totalLength = (this._input as string).length;
    const remainingLength = this.remaining.length;
    return totalLength > 0 ? (totalLength - remainingLength) / totalLength : 1;
  }
}
