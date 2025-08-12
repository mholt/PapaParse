/**
 * Performance Benchmark Harness
 *
 * Micro-benchmark harness for rows/second testing to ensure performance
 * parity between legacy and modern implementations.
 *
 * Uses child processes for complete memory isolation between tests.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Calculate statistical metrics for an array of numbers
 */
function calculateStats(values: number[]) {
  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      rawValues: [],
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // Calculate standard deviation
  const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median,
    min,
    max,
    stdDev,
    rawValues: values,
  };
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

// Interface for benchmark results
export interface BenchmarkResult {
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
  statistics: {
    runs: number;
    timings: {
      mean: number;
      median: number;
      min: number;
      max: number;
      stdDev: number;
      rawTimes: number[];
    };
    rowsPerSecond: {
      mean: number;
      median: number;
      min: number;
      max: number;
      stdDev: number;
      rawValues: number[];
    };
    memoryPeak: {
      mean: number;
      median: number;
      min: number;
      max: number;
      stdDev: number;
      rawValues: number[];
    };
  };
}

// Interface for test data
export interface TestData {
  name: string;
  csvContent: string;
  expectedRows: number;
  description: string;
}

/**
 * Performance benchmark runner
 */
export class PerformanceBenchmark {
  private testData: TestData[] = [];

  /**
   * Add test data to the benchmark suite
   */
  addTestData(data: TestData): void {
    this.testData.push(data);
  }

  /**
   * Generate large test data for stress testing
   */
  generateLargeTestData(rows: number, columns: number, withQuotes: boolean = false): TestData {
    const headers = Array.from({ length: columns }, (_, i) => `column_${i}`);
    const csvLines = [headers.join(",")];

    for (let i = 0; i < rows; i++) {
      const row = Array.from({ length: columns }, (_, j) => {
        // Mix of data types to test dynamic typing
        if (j % 4 === 0) {
          return withQuotes ? `"string_value_${i}_${j}"` : `string_value_${i}_${j}`;
        }
        if (j % 4 === 1) return String(Math.random() * 1000);
        if (j % 4 === 2) return Math.random() > 0.5 ? "true" : "false";
        return String(i * j);
      });
      csvLines.push(row.join(","));
    }

    const suffix = withQuotes ? "_with_quotes" : "";
    return {
      name: `large_${rows}x${columns}${suffix}`,
      csvContent: csvLines.join("\n"),
      expectedRows: rows,
      description: `Large dataset with ${rows} rows and ${columns} columns${withQuotes ? " (with quotes)" : " (fast mode)"}`,
    };
  }

  /**
   * Generate CSV with problematic content to test edge cases
   */
  generateProblematicTestData(): TestData {
    const problematicRows = [
      "header1,header2,header3",
      '"quoted,with,commas","normal","escaped""quote"',
      'line\nbreak,normal,"quoted\nline\nbreak"',
      '123.456,true,"formula:=SUM(A1:A2)"',
      '"",,empty middle',
      "unicode,émojis,🚀🎉",
      `very long field,normal,"${"x".repeat(10000)}"`,
    ];

    return {
      name: "problematic_content",
      csvContent: problematicRows.join("\n"),
      expectedRows: 6,
      description: "CSV with quotes, line breaks, unicode, and edge cases",
    };
  }

  /**
   * Run a single isolated benchmark iteration in child process
   */
  private async runSingleIteration(testData: TestData, implementation: "legacy" | "modern"): Promise<SingleRunResult> {
    return new Promise((resolve, reject) => {
      // Use ts-node to run TypeScript directly, or look for compiled JS
      const workerScript = path.join(__dirname, "benchmark-worker.js");
      const workerScriptTs = path.join(__dirname, "benchmark-worker.ts");

      // Check if compiled JS exists, otherwise use ts-node
      const scriptToRun = fs.existsSync(workerScript) ? workerScript : workerScriptTs;
      const nodeArgs = scriptToRun.endsWith(".ts") ? ["-r", "ts-node/register", scriptToRun] : [scriptToRun];

      // Spawn child process for complete isolation
      const child = spawn("node", nodeArgs, {
        stdio: ["pipe", "pipe", "pipe", "ipc"],
        env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
      });

      let output = "";
      let errorOutput = "";

      child.stdout?.on("data", (data) => {
        output += data.toString();
      });

      child.stderr?.on("data", (data) => {
        errorOutput += data.toString();
      });

      // Send test configuration to child process
      child.send({
        testData,
        implementation,
      });

      // Handle result from child process
      child.on("message", (result: SingleRunResult) => {
        resolve(result);
      });

      child.on("error", (error) => {
        reject(new Error(`Child process error: ${error.message}`));
      });

      child.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Child process exited with code ${code}. Error: ${errorOutput}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill();
        reject(new Error(`Benchmark timeout for ${testData.name}`));
      }, 30000);
    });
  }

  /**
   * Run multiple isolated benchmark iterations and aggregate results
   */
  private async runIsolatedBenchmark(
    testData: TestData,
    implementation: "legacy" | "modern",
  ): Promise<BenchmarkResult> {
    const BENCHMARK_RUNS = 10;
    const runs: SingleRunResult[] = [];

    console.log(`Running ${BENCHMARK_RUNS} isolated iterations for ${testData.name} (${implementation})`);

    // Run multiple iterations in parallel with limited concurrency to avoid overwhelming the system
    const concurrency = 3; // Run 3 child processes at a time
    for (let i = 0; i < BENCHMARK_RUNS; i += concurrency) {
      const batch = [];
      for (let j = 0; j < concurrency && i + j < BENCHMARK_RUNS; j++) {
        batch.push(this.runSingleIteration(testData, implementation));
      }

      const batchResults = await Promise.all(batch);
      runs.push(...batchResults);

      // Small delay between batches to prevent system overload
      if (i + concurrency < BENCHMARK_RUNS) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Extract metrics from all runs
    const times = runs.map((r) => r.totalTime);
    const rowsPerSecondValues = runs.map((r) => r.rowsPerSecond);
    const memoryPeaks = runs.map((r) => r.memoryUsage.peak.heapUsed);
    const totalErrors = runs.reduce((sum, r) => sum + r.errors, 0);

    // Calculate statistics
    const timeStats = calculateStats(times);
    const rowsPerSecondStats = calculateStats(rowsPerSecondValues);
    const memoryStats = calculateStats(memoryPeaks);

    // Use the first run for baseline memory measurements (they should be similar)
    const firstRun = runs[0];

    // Create aggregated result
    const result: BenchmarkResult = {
      implementation,
      testName: testData.name,
      rowsPerSecond: Math.round(rowsPerSecondStats.mean),
      totalRows: testData.expectedRows,
      totalTime: timeStats.mean,
      memoryUsage: {
        before: firstRun.memoryUsage.before,
        after: firstRun.memoryUsage.after,
        peak: {
          ...firstRun.memoryUsage.peak,
          heapUsed: Math.round(memoryStats.mean),
        },
      },
      errors: totalErrors,
      statistics: {
        runs: BENCHMARK_RUNS,
        timings: {
          ...timeStats,
          rawTimes: times,
        },
        rowsPerSecond: {
          ...rowsPerSecondStats,
          rawValues: rowsPerSecondValues,
        },
        memoryPeak: {
          ...memoryStats,
          rawValues: memoryPeaks,
        },
      },
    };

    return result;
  }

  /**
   * Run benchmark against legacy implementation
   */
  async benchmarkLegacy(testData: TestData, parser: any): Promise<BenchmarkResult> {
    return this.runIsolatedBenchmark(testData, "legacy");
  }

  /**
   * Run benchmark against modern implementation
   */
  async benchmarkModern(testData: TestData, parser: any): Promise<BenchmarkResult> {
    return this.runIsolatedBenchmark(testData, "modern");
  }

  /**
   * Compare benchmark results and detect regressions
   */
  compareResults(
    legacyResult: BenchmarkResult,
    modernResult: BenchmarkResult,
  ): {
    passed: boolean;
    performanceRatio: number;
    memoryRatio: number;
    details: string;
  } {
    const performanceRatio = modernResult.rowsPerSecond / legacyResult.rowsPerSecond;
    const memoryRatio = modernResult.memoryUsage.peak.heapUsed / legacyResult.memoryUsage.peak.heapUsed;

    const PERFORMANCE_THRESHOLD = 0.95; // Modern should be within 5% of legacy
    const MEMORY_THRESHOLD = 1.1; // Modern should use no more than 10% additional memory

    const performancePassed = performanceRatio >= PERFORMANCE_THRESHOLD;
    const memoryPassed = memoryRatio <= MEMORY_THRESHOLD;
    const passed = performancePassed && memoryPassed;

    let details = `Performance: ${(performanceRatio * 100).toFixed(1)}% of legacy speed`;
    details += `\nMemory: ${(memoryRatio * 100).toFixed(1)}% of legacy memory usage`;

    if (!performancePassed) {
      details += `\n❌ Performance regression detected: ${((1 - performanceRatio) * 100).toFixed(1)}% slower`;
    }
    if (!memoryPassed) {
      details += `\n❌ Memory regression detected: ${((memoryRatio - 1) * 100).toFixed(1)}% more memory`;
    }
    if (passed) {
      details += "\n✅ All benchmarks passed";
    }

    return {
      passed,
      performanceRatio,
      memoryRatio,
      details,
    };
  }

  /**
   * Run full benchmark suite
   */
  async runBenchmarkSuite(
    legacyParser: any,
    modernParser: any,
  ): Promise<{
    results: BenchmarkResult[];
    comparisons: Array<{
      testName: string;
      legacyResult: BenchmarkResult;
      modernResult: BenchmarkResult;
      comparison: {
        passed: boolean;
        performanceRatio: number;
        memoryRatio: number;
        details: string;
      };
    }>;
    summary: {
      passed: boolean;
      totalTests: number;
      passedTests: number;
      failedTests: number;
      avgPerformanceRatio: number;
      avgMemoryRatio: number;
    };
  }> {
    const results: BenchmarkResult[] = [];
    const comparisons: Array<{
      testName: string;
      legacyResult: BenchmarkResult;
      modernResult: BenchmarkResult;
      comparison: any;
    }> = [];
    let passedTests = 0;
    let totalPerformanceRatio = 0;
    let totalMemoryRatio = 0;

    // Add standard test datasets - test both fast mode and quote handling
    this.addTestData(this.generateLargeTestData(10000, 10, false)); // Fast mode
    this.addTestData(this.generateLargeTestData(100000, 5, false)); // Fast mode
    this.addTestData(this.generateLargeTestData(10000, 10, true)); // With quotes
    this.addTestData(this.generateProblematicTestData());

    for (const testData of this.testData) {
      console.log(`Running benchmark: ${testData.name}`);

      const legacyResult = await this.benchmarkLegacy(testData, legacyParser);
      const modernResult = await this.benchmarkModern(testData, modernParser);

      results.push(legacyResult, modernResult);

      const comparison = this.compareResults(legacyResult, modernResult);
      comparisons.push({
        testName: testData.name,
        legacyResult,
        modernResult,
        comparison,
      });

      if (comparison.passed) {
        passedTests++;
      }

      totalPerformanceRatio += comparison.performanceRatio;
      totalMemoryRatio += comparison.memoryRatio;
    }

    const totalTests = this.testData.length;
    const avgPerformanceRatio = totalPerformanceRatio / totalTests;
    const avgMemoryRatio = totalMemoryRatio / totalTests;

    return {
      results,
      comparisons,
      summary: {
        passed: passedTests === totalTests,
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        avgPerformanceRatio,
        avgMemoryRatio,
      },
    };
  }

  /**
   * Export benchmark results to JSON
   */
  exportResults(results: BenchmarkResult[], filename: string): void {
    const outputPath = path.join(process.cwd(), "benchmark-results", filename);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`Benchmark results exported to: ${outputPath}`);
  }

  /**
   * Render benchmark results as a formatted table
   */
  renderResultsTable(
    comparisons: Array<{
      testName: string;
      legacyResult: BenchmarkResult;
      modernResult: BenchmarkResult;
      comparison: any;
    }>,
  ): void {
    console.log("\n📊 Performance Benchmark Results Table:");

    // Table headers
    const headers = [
      "Test Name",
      "Legacy (rows/s)",
      "Modern (rows/s)",
      "Performance",
      "Std Dev %",
      "Legacy Memory",
      "Modern Memory",
      "Memory Ratio",
      "Status",
    ];

    // Prepare all table data first to calculate column widths
    const tableData: string[][] = [];

    // Add header row
    tableData.push(headers);

    // Process data rows
    comparisons.forEach(({ testName, legacyResult, modernResult, comparison }) => {
      const legacyMemMB = (legacyResult.memoryUsage.peak.heapUsed / 1024 / 1024).toFixed(1);
      const modernMemMB = (modernResult.memoryUsage.peak.heapUsed / 1024 / 1024).toFixed(1);

      // Handle special cases for performance ratio
      let performancePercent: string;
      let performanceIcon = "";
      if (isNaN(comparison.performanceRatio)) {
        performancePercent = "N/A";
        performanceIcon = "⚪";
      } else if (!isFinite(comparison.performanceRatio)) {
        performancePercent = "∞";
        performanceIcon = "🚀";
      } else {
        const ratio = comparison.performanceRatio;
        if (ratio >= 1.05) {
          performanceIcon = "🟢"; // Green circle for performance improvement
        } else if (ratio <= 0.95) {
          performanceIcon = "🔴"; // Red circle for performance regression
        } else {
          performanceIcon = "🟡"; // Yellow circle for neutral/similar performance
        }
        performancePercent = `${(ratio * 100).toFixed(1)}%`;
      }

      // Memory ratio with direction indicator
      let memoryIcon = "";
      if (comparison.memoryRatio >= 1.1) {
        memoryIcon = "🔴"; // Red circle for increased memory usage (bad)
      } else if (comparison.memoryRatio <= 0.9) {
        memoryIcon = "🟢"; // Green circle for decreased memory usage (good)
      } else {
        memoryIcon = "🟡"; // Yellow circle for similar memory usage
      }
      const memoryPercent = `${memoryIcon} ${(comparison.memoryRatio * 100).toFixed(1)}%`;

      const status = comparison.passed ? "✅ PASS" : "❌ FAIL";

      // Handle special cases for rows per second
      const legacyRowsPerSec =
        legacyResult.rowsPerSecond === null || isNaN(legacyResult.rowsPerSecond)
          ? "N/A"
          : legacyResult.rowsPerSecond.toLocaleString();

      let modernRowsPerSec: string;
      if (modernResult.rowsPerSecond === null || isNaN(modernResult.rowsPerSecond)) {
        modernRowsPerSec = "⚪ N/A";
      } else {
        // Add performance direction indicator to modern rows/sec
        let rowsIcon = "";
        if (legacyResult.rowsPerSecond && modernResult.rowsPerSecond) {
          const ratio = modernResult.rowsPerSecond / legacyResult.rowsPerSecond;
          if (ratio >= 1.05) {
            rowsIcon = "🟢"; // Green circle for faster rows/sec
          } else if (ratio <= 0.95) {
            rowsIcon = "🔴"; // Red circle for slower rows/sec
          } else {
            rowsIcon = "🟡"; // Yellow circle for similar rows/sec
          }
        }
        modernRowsPerSec = `${rowsIcon} ${modernResult.rowsPerSecond.toLocaleString()}`;
      }

      // Calculate coefficient of variation for stability
      const modernStdDevPercent = modernResult.statistics
        ? ((modernResult.statistics.rowsPerSecond.stdDev / modernResult.statistics.rowsPerSecond.mean) * 100).toFixed(
            1,
          ) + "%"
        : "N/A";

      const row = [
        testName,
        legacyRowsPerSec,
        modernRowsPerSec,
        `${performanceIcon} ${performancePercent}`,
        modernStdDevPercent,
        `${legacyMemMB} MB`,
        `${modernMemMB} MB`,
        memoryPercent,
        status,
      ];

      tableData.push(row);
    });

    // Calculate optimal column widths
    const colWidths = headers.map((_, colIndex) => {
      const maxWidth = Math.max(...tableData.map((row) => row[colIndex]?.length || 0));
      // Add 2 chars padding, minimum 8 chars
      return Math.max(maxWidth + 2, 8);
    });

    // Calculate total table width
    const totalWidth = colWidths.reduce((sum, width) => sum + width, 0) + (colWidths.length - 1) * 3; // 3 for " | "

    console.log("=".repeat(totalWidth));

    // Print header
    let headerRow = "";
    headers.forEach((header, i) => {
      headerRow += header.padEnd(colWidths[i]);
      if (i < headers.length - 1) headerRow += " | ";
    });
    console.log(headerRow);
    console.log("-".repeat(totalWidth));

    // Print data rows (skip header row in tableData)
    for (let i = 1; i < tableData.length; i++) {
      const row = tableData[i];
      let dataRow = "";
      row.forEach((cell, j) => {
        dataRow += cell.padEnd(colWidths[j]);
        if (j < row.length - 1) dataRow += " | ";
      });
      console.log(dataRow);
    }

    console.log("=".repeat(totalWidth));
  }
}

// CLI runner for CI/CD integration
export async function runCIBenchmark(): Promise<void> {
  console.log("🚀 Starting PapaParse Performance Benchmark...");

  const benchmark = new PerformanceBenchmark();

  try {
    // Import both implementations
    const legacyPapa = require("../../legacy/papaparse.js");
    const modernPapaModule = require("../../dist/papaparse.js");
    const modernPapa = modernPapaModule.default || modernPapaModule;

    console.log("📊 Running performance comparison between legacy and V6 implementations...");

    // Run the benchmark suite
    const { results, comparisons, summary } = await benchmark.runBenchmarkSuite(legacyPapa, modernPapa);

    // Render results table
    benchmark.renderResultsTable(comparisons);

    // Export results for analysis
    benchmark.exportResults(results, `benchmark-${Date.now()}.json`);

    // Print summary
    console.log("\n📈 Summary:");
    console.log(`  Total Tests: ${summary.totalTests}`);
    console.log(`  Passed: ${summary.passedTests}`);
    console.log(`  Failed: ${summary.failedTests}`);
    console.log(`  Average Performance: ${(summary.avgPerformanceRatio * 100).toFixed(1)}% of legacy`);
    console.log(`  Average Memory Usage: ${(summary.avgMemoryRatio * 100).toFixed(1)}% of legacy`);

    // Show detailed failure information
    if (!summary.passed) {
      console.log("\n❌ Failed Tests:");
      comparisons.forEach(({ testName, comparison }) => {
        if (!comparison.passed) {
          console.log(`  ${testName}:`);
          if (comparison.performanceRatio < 0.95) {
            console.log(`    🐌 Performance: ${(comparison.performanceRatio * 100).toFixed(1)}% (need ≥95%)`);
          }
          if (comparison.memoryRatio > 1.1) {
            console.log(`    🧠 Memory: ${(comparison.memoryRatio * 100).toFixed(1)}% (need ≤110%)`);
          }
        }
      });
      console.error("\n❌ Performance benchmarks failed - some tests did not meet thresholds");
      process.exit(1);
    }

    console.log("✅ All performance benchmarks passed!");
  } catch (error) {
    console.error("❌ Benchmark failed:", error);
    process.exit(1);
  }
}

// Export for use in other modules
export default PerformanceBenchmark;
