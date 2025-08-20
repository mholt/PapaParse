/**
 * Benchmark Worker - Isolated test runner for single iteration benchmarks
 *
 * This runs in a child process to provide complete memory isolation
 * for each individual benchmark iteration.
 */

import * as path from "node:path";

interface TestData {
  name: string;
  csvContent: string;
  expectedRows: number;
  description: string;
}

interface WorkerMessage {
  testData: TestData;
  implementation: "legacy" | "modern";
}

interface SingleRunResult {
  implementation: "legacy" | "modern";
  testName: string;
  rowsPerSecond: number;
  totalRows: number;
  totalTime: number;
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
  };
  errors: number;
}

/**
 * Run a single benchmark iteration in complete isolation
 */
async function runSingleBenchmark(testData: TestData, implementation: "legacy" | "modern"): Promise<SingleRunResult> {
  // Load the appropriate parser implementation
  let parser: any;

  try {
    if (implementation === "legacy") {
      // Load legacy implementation
      const legacyPath = path.resolve(__dirname, "../../legacy/papaparse.js");
      parser = require(legacyPath);
    } else {
      // Load modern implementation
      const modernPath = path.resolve(__dirname, "../../dist/papaparse.js");
      const modernModule = require(modernPath);
      parser = modernModule.default || modernModule;
    }
  } catch (error) {
    throw new Error(`Failed to load ${implementation} parser: ${error}`);
  }

  // Wait a moment for any module loading to settle
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Measure memory before parsing
  const memBefore = process.memoryUsage();
  let memPeak = memBefore;

  // Start memory monitoring with minimal overhead
  const memoryMonitor = setInterval(() => {
    const current = process.memoryUsage();
    if (current.heapUsed > memPeak.heapUsed) {
      memPeak = current;
    }
  }, 2); // High frequency sampling for accuracy

  // Start timing just before parsing
  const startTime = process.hrtime.bigint();

  let results: any;
  let parseError: Error | null = null;

  try {
    // Run the actual parsing
    results = parser.parse(testData.csvContent, {
      header: false,
      // Use consistent options for fair comparison
      skipEmptyLines: false,
      delimiter: "",
      newline: "",
      quoteChar: '"',
      escapeChar: '"',
      dynamicTyping: false,
      preview: 0,
      encoding: "",
      worker: false,
      comments: false,
      step: undefined,
      complete: undefined,
      error: undefined,
      download: false,
      downloadRequestHeaders: undefined,
      downloadRequestBody: undefined,
      skipFirstNLines: 0,
      fastMode: undefined,
      beforeFirstChunk: undefined,
      chunkSize: undefined,
      withCredentials: undefined,
      transform: undefined,
      transformHeader: undefined,
    });
  } catch (error) {
    parseError = error as Error;
    results = { data: [], errors: [error], meta: {} };
  }

  // Stop timing immediately after parsing
  const endTime = process.hrtime.bigint();
  clearInterval(memoryMonitor);

  // Measure memory after parsing
  const memAfter = process.memoryUsage();

  // Calculate timing in milliseconds with high precision
  const totalTimeNs = endTime - startTime;
  const totalTime = Number(totalTimeNs) / 1_000_000; // Convert to milliseconds

  // Calculate rows per second (handle edge cases)
  let rowsPerSecond: number;
  if (totalTime <= 0) {
    rowsPerSecond = Number.POSITIVE_INFINITY;
  } else if (testData.expectedRows <= 0) {
    rowsPerSecond = 0;
  } else {
    rowsPerSecond = (testData.expectedRows / totalTime) * 1000;
  }

  // Count errors (handle different result formats)
  let errorCount = 0;
  if (parseError) {
    errorCount = 1;
  } else if (results && results.errors) {
    errorCount = Array.isArray(results.errors) ? results.errors.length : 0;
  }

  const result: SingleRunResult = {
    implementation,
    testName: testData.name,
    rowsPerSecond,
    totalRows: testData.expectedRows,
    totalTime,
    memoryUsage: {
      before: memBefore,
      after: memAfter,
      peak: memPeak,
    },
    errors: errorCount,
  };

  return result;
}

/**
 * Handle messages from parent process
 */
process.on("message", async (message: WorkerMessage) => {
  try {
    const result = await runSingleBenchmark(message.testData, message.implementation);

    // Send result back to parent
    if (process.send) {
      process.send(result);
    }

    // Exit cleanly
    process.exit(0);
  } catch (error) {
    console.error(`Benchmark worker error:`, error);
    process.exit(1);
  }
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in benchmark worker:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection in benchmark worker:", reason);
  process.exit(1);
});
