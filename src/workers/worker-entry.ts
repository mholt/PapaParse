/**
 * Worker Entry Point - Standalone worker bundle
 *
 * This module runs inside the Web Worker and handles CSV parsing
 * requests from the main thread. It provides the worker-side
 * message handling and Papa functionality.
 *
 * Legacy reference: lines 183-186, 1894-1920
 */

// Worker environment setup
declare const self: any;
declare let Papa: any;

// Global Papa object for worker context
let PapaWorker: any = null;

/**
 * Initialize Papa in worker context
 * This will import the main Papa functionality
 */
async function initializePapa() {
  if (PapaWorker) {
    return PapaWorker;
  }

  // Import the main Papa parse function
  // In a real build, this would be bundled together
  const { CsvToJson } = await import("../methods/csv-to-json");
  const { JsonToCsv } = await import("../methods/json-to-csv");

  // Create Papa object for worker
  PapaWorker = {
    parse: CsvToJson,
    unparse: JsonToCsv,
    WORKER_ID: undefined as number | undefined,
  };

  return PapaWorker;
}

/**
 * Worker message interface
 */
interface WorkerMessage {
  workerId: number;
  input: string | File | object;
  config: any; // PapaParseConfig
}

/**
 * Callback when worker thread receives a message from main thread
 * Legacy reference: workerThreadReceivedMessage (lines 1894-1920)
 */
async function workerThreadReceivedMessage(e: MessageEvent): Promise<void> {
  const msg = e.data as WorkerMessage;

  try {
    // Initialize Papa if not already done
    const Papa = await initializePapa();

    // Set worker ID if not already set (legacy compatibility)
    if (typeof Papa.WORKER_ID === "undefined" && msg) {
      Papa.WORKER_ID = msg.workerId;
    }

    let results: any = null;

    // Handle string input
    if (typeof msg.input === "string") {
      results = Papa.parse(msg.input, msg.config);

      self.postMessage({
        workerId: Papa.WORKER_ID,
        results: results,
        finished: true,
      });
    }
    // Handle File or Object input
    else if (
      (typeof File !== "undefined" && msg.input instanceof File) ||
      msg.input instanceof Object
    ) {
      results = Papa.parse(msg.input, msg.config);

      if (results) {
        self.postMessage({
          workerId: Papa.WORKER_ID,
          results: results,
          finished: true,
        });
      }
    }
  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      workerId: msg.workerId,
      error: {
        type: "WorkerError",
        code: "WORKER_PARSE_ERROR",
        message:
          error instanceof Error ? error.message : "Unknown worker error",
        details: error,
      },
      finished: true,
    });
  }
}

/**
 * Setup worker message handling
 * Legacy reference: IS_PAPA_WORKER check (lines 183-186)
 */
function setupWorkerMessageHandling(): void {
  // Check if we're in a worker context
  if (typeof self !== "undefined" && typeof self.onmessage !== "undefined") {
    self.onmessage = workerThreadReceivedMessage;
  }
}

/**
 * Worker initialization
 * This runs when the worker script is loaded
 */
(function initializeWorker() {
  // Set global flag for worker context
  (self as any).IS_PAPA_WORKER = true;

  // Setup message handling
  setupWorkerMessageHandling();

  // Signal that worker is ready (optional)
  console.log("PapaParse worker initialized");
})();

// Export for potential direct use
export { workerThreadReceivedMessage, setupWorkerMessageHandling };
