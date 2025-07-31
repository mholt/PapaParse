/**
 * Performance Benchmark Harness
 *
 * Micro-benchmark harness for rows/second testing to ensure performance
 * parity between legacy and modern implementations.
 */

import * as fs from "node:fs";
import * as path from "node:path";

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
   * Run benchmark against legacy implementation
   */
  async benchmarkLegacy(testData: TestData, parser: any): Promise<BenchmarkResult> {
    // Force garbage collection and wait for it to complete
    if (global.gc) {
      global.gc();
      global.gc(); // Run twice to ensure full cleanup
    }
    
    // Wait a bit for GC to settle
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const memBefore = process.memoryUsage();
    let memPeak = memBefore;

    return new Promise((resolve, reject) => {
      try {
        // Start timing just before parsing (no memory overhead)
        const startTime = Date.now();
        
        // Monitor memory usage during parsing (minimal overhead)
        const memoryMonitor = setInterval(() => {
          const current = process.memoryUsage();
          if (current.heapUsed > memPeak.heapUsed) {
            memPeak = current;
          }
        }, 10);

        // Use synchronous parsing for fair comparison
        const results = parser.parse(testData.csvContent, {
          header: false,
          // dynamicTyping: true,
        });

        // Stop timing immediately after parsing
        const endTime = Date.now();
        clearInterval(memoryMonitor);
        
        // Memory measurement after timing is complete
        const memAfter = process.memoryUsage();

        const totalTime = endTime - startTime;
        const rowsPerSecond = Math.round((testData.expectedRows / totalTime) * 1000);

        resolve({
          implementation: "legacy",
          testName: testData.name,
          rowsPerSecond,
          totalRows: testData.expectedRows,
          totalTime,
          memoryUsage: {
            before: memBefore,
            after: memAfter,
            peak: memPeak,
          },
          errors: results.errors.length,
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Run benchmark against modern implementation
   */
  async benchmarkModern(testData: TestData, parser: any): Promise<BenchmarkResult> {
    // Force garbage collection and wait for it to complete
    if (global.gc) {
      global.gc();
      global.gc(); // Run twice to ensure full cleanup
    }
    
    // Wait a bit for GC to settle
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const memBefore = process.memoryUsage();
    let memPeak = memBefore;

    return new Promise((resolve, reject) => {
      try {
        // Start timing just before parsing (no memory overhead)
        const startTime = Date.now();
        
        // Monitor memory usage during parsing (minimal overhead)
        const memoryMonitor = setInterval(() => {
          const current = process.memoryUsage();
          if (current.heapUsed > memPeak.heapUsed) {
            memPeak = current;
          }
        }, 10);

        // Use synchronous parsing for better DirectParser testing
        const results = parser.parse(testData.csvContent, {
          header: false,
          // dynamicTyping: true,
        });

        // Stop timing immediately after parsing
        const endTime = Date.now();
        clearInterval(memoryMonitor);
        
        // Memory measurement after timing is complete
        const memAfter = process.memoryUsage();

        const totalTime = endTime - startTime;
        const rowsPerSecond = Math.round((testData.expectedRows / totalTime) * 1000);

        resolve({
          implementation: "modern",
          testName: testData.name,
          rowsPerSecond,
          totalRows: testData.expectedRows,
          totalTime,
          memoryUsage: {
            before: memBefore,
            after: memAfter,
            peak: memPeak,
          },
          errors: results.errors.length,
        });
      } catch (error) {
        reject(error);
      }
    });
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

      const row = [
        testName,
        legacyRowsPerSec,
        modernRowsPerSec,
        `${performanceIcon} ${performancePercent}`,
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
