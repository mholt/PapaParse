/**
 * Base ChunkStreamer class for various streamer implementations.
 *
 * This serves as the coordination layer between different input sources
 * (strings, files, network, streams) and the parser engine.
 *
 * Based on legacy implementation: lines 487-563
 */

import { ParserHandle } from "../core/parser-handle";
import type { PapaParseConfig, PapaParseError, PapaParseResult } from "../types";
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

    // Pre-computed constants for performance
    protected _skipLines = 0;
    protected _hasSkip = false;
    protected _newline?: "\r" | "\n" | "\r\n";
    protected _hasBeforeFirstChunk = false;
    protected _hasChunkCallback = false;
    protected _hasStepCallback = false;
    protected _hasCompleteCallback = false;
    protected _hasErrorCallback = false;

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

        // Pre-compute constants for performance
        this._skipLines = parseInt(String(configCopy.skipFirstNLines || 0)) || 0;
        this._hasSkip = this._skipLines > 0;
        this._newline = configCopy.newline as "\r" | "\n" | "\r\n" | undefined;
        this._hasBeforeFirstChunk = isFunction(configCopy.beforeFirstChunk);
        this._hasChunkCallback = isFunction(configCopy.chunk);
        this._hasStepCallback = isFunction(configCopy.step);
        this._hasCompleteCallback = isFunction(configCopy.complete);
        this._hasErrorCallback = isFunction(configCopy.error);
    }

    /**
     * Parse a chunk of data and coordinate with the parser handle.
     * Handles first chunk preprocessing, partial line management, and result coordination.
     */
    parseChunk(chunk: string, isFakeChunk?: boolean): any {
        // Cache frequently accessed properties
        const config = this._config;
        const handle = this._handle;

        // First chunk pre-processing for line skipping - optimized with indexOf scanning
        if (this.isFirstChunk && this._hasSkip) {
            let newline = this._newline;
            if (!newline) {
                const quoteChar = config.quoteChar || '"';
                newline = (handle.guessLineEndings(chunk, quoteChar) as "\r" | "\n" | "\r\n" | undefined) || "\n";
            }

            // Use indexOf scanning instead of split/join for better performance
            let idx = -1;
            for (let i = 0; i < this._skipLines; i++) {
                idx = chunk.indexOf(newline, idx + 1);
                if (idx === -1) break;
            }
            if (idx !== -1) {
                chunk = chunk.slice(idx + newline.length);
            }
        }

        // Allow first chunk modification
        if (this.isFirstChunk && this._hasBeforeFirstChunk) {
            const modifiedChunk = config.beforeFirstChunk!(chunk);
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
        if ((handle as any).state) {
            (handle as any).state.rowCounter = this._rowCount;
        }

        let results = handle.parse(aggregate, this._baseIndex, !this._finished);

        if (handle.paused() || handle.aborted()) {
            this._halted = true;
            return;
        }

        const lastIndex = results.meta.cursor || 0;

        if (!this._finished) {
            this._partialLine = aggregate.substring(lastIndex - this._baseIndex);
            this._baseIndex = lastIndex;
        }

        if (results?.data) {
            this._rowCount += results.data.length;
        }

        const finishedIncludingPreview = this._finished || (config.preview && this._rowCount >= config.preview);

        // Worker coordination
        if (typeof IS_PAPA_WORKER !== "undefined" && IS_PAPA_WORKER) {
            if (typeof global !== "undefined" && global.postMessage) {
                global.postMessage({
                    results: results,
                    workerId: Papa.WORKER_ID,
                    finished: finishedIncludingPreview,
                });
            }
        } else if (this._hasChunkCallback && !isFakeChunk) {
            config.chunk!(results, handle);
            if (handle?.paused() || handle?.aborted()) {
                this._halted = true;
                return;
            }
            results = undefined as any;
            this._completeResults = undefined as any;
        }

        // Accumulate results when not using step or chunk callbacks - optimized with push instead of concat
        if (!this._hasStepCallback && !this._hasChunkCallback) {
            // Use push.apply for much better performance than concat
            Array.prototype.push.apply(this._completeResults.data, results.data);
            Array.prototype.push.apply(this._completeResults.errors, results.errors);
            this._completeResults.meta = results.meta;
        }

        if (
            !this._completed &&
            finishedIncludingPreview &&
            this._hasCompleteCallback &&
            (!results || !results.meta.aborted)
        ) {
            config.complete!(this._completeResults);
            this._completed = true;
        }

        // Continue streaming unless we are finished or currently paused (legacy lines 583-585)
        if (!finishedIncludingPreview && (!results || !(results.meta as any).paused)) {
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
    stream(_input?: any): any {
        throw new Error("stream() method must be implemented by concrete streamer classes");
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
        if (this._hasErrorCallback) {
            this._config.error!(error);
        } else if (typeof IS_PAPA_WORKER !== "undefined" && IS_PAPA_WORKER && this._config.error) {
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
