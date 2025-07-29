/**
 * Performance Benchmark Harness
 *
 * Micro-benchmark harness for rows/second testing to ensure performance
 * parity between legacy and modern implementations.
 */

import * as fs from "fs";
import * as path from "path";

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
  private results: BenchmarkResult[] = [];

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
      "very long field,normal," + '"' + "x".repeat(10000) + '"',
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
    const memBefore = process.memoryUsage();
    let memPeak = memBefore;

    // Monitor memory usage during parsing
    const memoryMonitor = setInterval(() => {
      const current = process.memoryUsage();
      if (current.heapUsed > memPeak.heapUsed) {
        memPeak = current;
      }
    }, 10);

    const startTime = Date.now();
    let errorCount = 0;

    return new Promise((resolve, reject) => {
      try {
        const result = parser.parse(testData.csvContent, {
          header: false,
          dynamicTyping: true,
          complete: (results: any) => {
            const endTime = Date.now();
            clearInterval(memoryMonitor);
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
              errors: errorCount,
            });
          },
          error: (error: any) => {
            errorCount++;
            console.warn(`Legacy parsing error: ${error.message}`);
          },
        });
      } catch (error) {
        clearInterval(memoryMonitor);
        reject(error);
      }
    });
  }

  /**
   * Run benchmark against modern implementation
   */
  async benchmarkModern(testData: TestData, parser: any): Promise<BenchmarkResult> {
    const memBefore = process.memoryUsage();
    let memPeak = memBefore;

    const memoryMonitor = setInterval(() => {
      const current = process.memoryUsage();
      if (current.heapUsed > memPeak.heapUsed) {
        memPeak = current;
      }
    }, 10);

    const startTime = Date.now();
    let errorCount = 0;

    return new Promise((resolve, reject) => {
      try {
        const result = parser.parse(testData.csvContent, {
          header: false,
          dynamicTyping: true,
          complete: (results: any) => {
            const endTime = Date.now();
            clearInterval(memoryMonitor);
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
              errors: errorCount,
            });
          },
          error: (error: any) => {
            errorCount++;
            console.warn(`Modern parsing error: ${error.message}`);
          },
        });
      } catch (error) {
        clearInterval(memoryMonitor);
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
    let passedTests = 0;
    let totalPerformanceRatio = 0;
    let totalMemoryRatio = 0;

    // Add standard test datasets - test both fast mode and quote handling
    this.addTestData(this.generateLargeTestData(10000, 10, false)); // Fast mode
    this.addTestData(this.generateLargeTestData(50000, 5, false)); // Fast mode
    this.addTestData(this.generateLargeTestData(10000, 10, true)); // With quotes
    this.addTestData(this.generateProblematicTestData());

    for (const testData of this.testData) {
      console.log(`Running benchmark: ${testData.name}`);

      const legacyResult = await this.benchmarkLegacy(testData, legacyParser);
      const modernResult = await this.benchmarkModern(testData, modernParser);

      results.push(legacyResult, modernResult);

      const comparison = this.compareResults(legacyResult, modernResult);
      if (comparison.passed) {
        passedTests++;
      }

      totalPerformanceRatio += comparison.performanceRatio;
      totalMemoryRatio += comparison.memoryRatio;

      console.log(`${testData.name}: ${comparison.details}`);
    }

    const totalTests = this.testData.length;
    const avgPerformanceRatio = totalPerformanceRatio / totalTests;
    const avgMemoryRatio = totalMemoryRatio / totalTests;

    return {
      results,
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
    const { results, summary } = await benchmark.runBenchmarkSuite(legacyPapa, modernPapa);

    // Export results for analysis
    benchmark.exportResults(results, `benchmark-${Date.now()}.json`);

    // Print summary
    console.log("\n📈 Performance Benchmark Results:");
    console.log(`  Total Tests: ${summary.totalTests}`);
    console.log(`  Passed: ${summary.passedTests}`);
    console.log(`  Failed: ${summary.failedTests}`);
    console.log(`  Average Performance Ratio: ${(summary.avgPerformanceRatio * 100).toFixed(1)}%`);
    console.log(`  Average Memory Ratio: ${(summary.avgMemoryRatio * 100).toFixed(1)}%`);

    if (!summary.passed) {
      console.error("❌ Performance benchmarks failed - some tests did not meet thresholds");
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
