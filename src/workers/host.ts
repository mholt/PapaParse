/**
 * Worker Host - Main thread worker orchestration
 *
 * This module provides worker creation and management for the main thread.
 * Handles worker lifecycle, message passing, and result coordination.
 *
 * Legacy reference: lines 1821-1920, 49-58
 */

import type { PapaParseConfig, PapaParseResult, PapaParseError } from "../types";

/**
 * Internal worker message types for communication
 */
interface WorkerMessage {
  workerId: number;
  input: string | File | object;
  config: PapaParseConfig;
}

interface WorkerResponse {
  workerId: number;
  results?: PapaParseResult;
  error?: PapaParseError;
  finished: boolean;
}

/**
 * Enhanced worker instance with user callbacks
 * Matches the legacy worker object structure
 */
interface WorkerInstance extends Worker {
  id: number;
  userStep?: (results: PapaParseResult, handle: any) => void;
  userChunk?: (results: PapaParseResult, handle: any, file?: File) => void;
  userComplete?: (results: PapaParseResult) => void;
  userError?: (error: PapaParseError, file?: File) => void;
}

// Global worker management (matches legacy behavior)
const workers: { [id: number]: WorkerInstance } = {};
let workerIdCounter = 0;
let workerBlobUrl: string | null = null;

/**
 * Creates worker blob URL with embedded Papa functionality
 * Legacy reference: getWorkerBlob (lines 49-53)
 */
function getWorkerBlob(): string {
  if (workerBlobUrl) {
    return workerBlobUrl;
  }

  const URL = globalThis.URL || (globalThis as any).webkitURL;
  if (!URL) {
    throw new Error("URL.createObjectURL not available for worker creation");
  }

  // Create worker code that includes the worker entry point
  // This will be enhanced in worker bundle compilation phase
  const workerCode = `
    // Global setup for worker context
    const global = (function() {
      if (typeof self !== 'undefined') { return self; }
      if (typeof window !== 'undefined') { return window; }
      if (typeof global !== 'undefined') { return global; }
      return {};
    })();

    global.IS_PAPA_WORKER = true;

    // Import and setup worker entry point
    // This is a placeholder - will be replaced with actual bundled code
    // Note: import.meta.url would be used in ES modules, but for CommonJS compatibility we use a relative path
    importScripts('./worker-entry.js');
  `;

  const blob = new Blob([workerCode], { type: "text/javascript" });
  workerBlobUrl = URL.createObjectURL(blob);
  return workerBlobUrl;
}

/**
 * Creates a new worker for CSV parsing
 * Legacy reference: newWorker (lines 1822-1833)
 *
 * @returns Worker instance for CSV parsing operations
 */
export function newWorker(): WorkerInstance | false {
  if (!workersSupported()) {
    return false;
  }

  try {
    const workerUrl = getWorkerBlob();
    const worker = new Worker(workerUrl) as WorkerInstance;

    worker.onmessage = mainThreadReceivedMessage;
    worker.id = workerIdCounter++;
    workers[worker.id] = worker;

    return worker;
  } catch (error) {
    console.warn("Failed to create worker:", error);
    return false;
  }
}

/**
 * Callback when main thread receives a message from worker
 * Legacy reference: mainThreadReceivedMessage (lines 1836-1880)
 */
function mainThreadReceivedMessage(e: MessageEvent): void {
  const msg = e.data as WorkerResponse;
  const worker = workers[msg.workerId];

  if (!worker) {
    console.warn("Received message from unknown worker:", msg.workerId);
    return;
  }

  let aborted = false;

  if (msg.error) {
    if (worker.userError) {
      worker.userError(msg.error);
    }
  } else if (msg.results && msg.results.data) {
    const abort = () => {
      aborted = true;
      completeWorker(msg.workerId, {
        data: [],
        errors: [],
        meta: {
          aborted: true,
          delimiter: "",
          linebreak: "",
          truncated: false,
          cursor: 0,
        },
      });
    };

    const handle = {
      abort,
      pause: notImplemented,
      resume: notImplemented,
    };

    // Handle step callback
    if (typeof worker.userStep === "function") {
      for (let i = 0; i < msg.results.data.length; i++) {
        worker.userStep(
          {
            data: msg.results.data[i],
            errors: msg.results.errors,
            meta: msg.results.meta,
          },
          handle,
        );
        if (aborted) break;
      }
      // Free memory ASAP
      delete (msg as any).results;
    }
    // Handle chunk callback
    else if (typeof worker.userChunk === "function") {
      worker.userChunk(msg.results, handle);
      delete (msg as any).results;
    }
  }

  if (msg.finished && !aborted) {
    completeWorker(msg.workerId, msg.results);
  }
}

/**
 * Completes worker processing and cleanup
 * Legacy reference: completeWorker (lines 1882-1888)
 */
function completeWorker(workerId: number, results?: PapaParseResult): void {
  const worker = workers[workerId];
  if (!worker) return;

  if (typeof worker.userComplete === "function" && results) {
    worker.userComplete(results);
  }

  worker.terminate();
  delete workers[workerId];
}

/**
 * Placeholder for unimplemented worker control methods
 * Legacy reference: notImplemented (lines 1890-1892)
 */
function notImplemented(): never {
  throw new Error("Not implemented.");
}

/**
 * Checks if workers are supported in the current environment
 * Legacy reference: Papa.WORKERS_SUPPORTED (line 69)
 *
 * @returns true if Web Workers are available
 */
export function workersSupported(): boolean {
  const isWorker = !globalThis.document && !!globalThis.postMessage;
  return (
    !isWorker &&
    typeof Worker !== "undefined" &&
    typeof Blob !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function"
  );
}

/**
 * Sends work to a worker
 * Used by main parsing functions when worker: true
 */
export function sendWorkToWorker(worker: WorkerInstance, input: string | File | object, config: PapaParseConfig): void {
  const message: WorkerMessage = {
    workerId: worker.id,
    input,
    config,
  };

  worker.postMessage(message);
}

/**
 * Cleanup function to terminate all workers
 * Useful for testing and application shutdown
 */
export function terminateAllWorkers(): void {
  for (const workerId in workers) {
    const worker = workers[workerId];
    worker.terminate();
    delete workers[workerId];
  }

  // Clean up blob URL
  if (workerBlobUrl) {
    URL.revokeObjectURL(workerBlobUrl);
    workerBlobUrl = null;
  }
}
