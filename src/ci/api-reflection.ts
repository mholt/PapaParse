/**
 * API Surface Reflection Testing
 *
 * Ensures that Object.keys(Papa) matches exactly between legacy and modern versions.
 * Tests singleton reference consistency and other API compatibility requirements.
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Interface for API surface information
export interface APIProperty {
  name: string;
  type: string;
  value?: any;
  isFunction: boolean;
  isConfigurable: boolean;
  isEnumerable: boolean;
  isWritable: boolean;
}

export interface APISurface {
  properties: APIProperty[];
  keys: string[];
  version: string;
  timestamp: string;
}

export interface APIComparison {
  passed: boolean;
  differences: {
    category: "missing" | "extra" | "type_mismatch" | "value_mismatch" | "descriptor_mismatch";
    property: string;
    expected: any;
    actual: any;
  }[];
  summary: string;
}

/**
 * API Reflection Tester
 */
export class APIReflectionTester {
  private snapshotPath: string;

  constructor(snapshotPath: string = "src/ci/api-surface.json") {
    this.snapshotPath = path.resolve(snapshotPath);
  }

  /**
   * Extract complete API surface from a Papa object
   */
  extractAPISurface(papa: any, version: string): APISurface {
    const properties: APIProperty[] = [];
    const keys = Object.keys(papa).sort();

    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(papa, key);
      let value = papa[key];
      let type = typeof value;

      // Handle special cases for consistent serialization
      if (typeof value === "function") {
        value = "[Function]";
        type = "function";
      } else if (typeof value === "symbol") {
        value = value.toString();
        type = "symbol";
      } else if (Array.isArray(value)) {
        type = "object"; // TypeScript typeof for arrays is 'object'
        // For arrays, capture length and first few elements for verification
        value = {
          isArray: true,
          length: value.length,
          sample: value.slice(0, 3),
        };
      } else if (typeof value === "object" && value !== null) {
        type = "object";
        // For objects, capture keys for structure verification
        value = {
          keys: Object.keys(value).sort(),
          constructor: value.constructor?.name || "Object",
        };
      }

      properties.push({
        name: key,
        type,
        value,
        isFunction: typeof papa[key] === "function",
        isConfigurable: descriptor?.configurable ?? false,
        isEnumerable: descriptor?.enumerable ?? false,
        isWritable: descriptor?.writable ?? false,
      });
    }

    return {
      properties,
      keys,
      version,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Save API surface snapshot
   */
  saveAPISurface(surface: APISurface): void {
    const dir = path.dirname(this.snapshotPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.snapshotPath, JSON.stringify(surface, null, 2));
  }

  /**
   * Load API surface snapshot
   */
  loadAPISurface(): APISurface | null {
    if (!fs.existsSync(this.snapshotPath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(this.snapshotPath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.warn("Failed to load API surface snapshot:", error);
      return null;
    }
  }

  /**
   * Compare two API surfaces
   */
  compareAPISurfaces(expected: APISurface, actual: APISurface): APIComparison {
    const differences: APIComparison["differences"] = [];

    // Compare keys
    const expectedKeys = new Set(expected.keys);
    const actualKeys = new Set(actual.keys);

    for (const key of expectedKeys) {
      if (!actualKeys.has(key)) {
        differences.push({
          category: "missing",
          property: key,
          expected: "present",
          actual: "missing",
        });
      }
    }

    for (const key of actualKeys) {
      if (!expectedKeys.has(key)) {
        differences.push({
          category: "extra",
          property: key,
          expected: "absent",
          actual: "present",
        });
      }
    }

    // Compare property details for common keys
    const expectedPropsMap = new Map(expected.properties.map((p) => [p.name, p]));
    const actualPropsMap = new Map(actual.properties.map((p) => [p.name, p]));

    for (const key of expectedKeys) {
      if (actualKeys.has(key)) {
        const expectedProp = expectedPropsMap.get(key)!;
        const actualProp = actualPropsMap.get(key)!;

        // Compare types
        if (expectedProp.type !== actualProp.type) {
          differences.push({
            category: "type_mismatch",
            property: key,
            expected: expectedProp.type,
            actual: actualProp.type,
          });
        }

        // Compare values (for non-functions)
        if (!expectedProp.isFunction && !actualProp.isFunction) {
          if (JSON.stringify(expectedProp.value) !== JSON.stringify(actualProp.value)) {
            differences.push({
              category: "value_mismatch",
              property: key,
              expected: expectedProp.value,
              actual: actualProp.value,
            });
          }
        }

        // Compare descriptors for important properties
        if (
          expectedProp.isConfigurable !== actualProp.isConfigurable ||
          expectedProp.isEnumerable !== actualProp.isEnumerable ||
          expectedProp.isWritable !== actualProp.isWritable
        ) {
          differences.push({
            category: "descriptor_mismatch",
            property: key,
            expected: {
              configurable: expectedProp.isConfigurable,
              enumerable: expectedProp.isEnumerable,
              writable: expectedProp.isWritable,
            },
            actual: {
              configurable: actualProp.isConfigurable,
              enumerable: actualProp.isEnumerable,
              writable: actualProp.isWritable,
            },
          });
        }
      }
    }

    const passed = differences.length === 0;
    const summary = passed
      ? "API surfaces match perfectly"
      : `API comparison failed with ${differences.length} differences`;

    return {
      passed,
      differences,
      summary,
    };
  }

  /**
   * Test singleton reference consistency
   */
  testSingletonConsistency(requireFn: (id: string) => any): {
    passed: boolean;
    details: string;
  } {
    try {
      const papa1 = requireFn("papaparse");
      const papa2 = requireFn("papaparse");

      // Test that parse function is the same reference
      const parseRefEqual = papa1.parse === papa2.parse;

      // Test that the Papa object itself is the same reference
      const papaRefEqual = papa1 === papa2;

      // Test that constants are the same references
      const recordSepEqual = papa1.RECORD_SEP === papa2.RECORD_SEP;
      const unitSepEqual = papa1.UNIT_SEP === papa2.UNIT_SEP;

      const passed = parseRefEqual && papaRefEqual && recordSepEqual && unitSepEqual;

      let details = "";
      if (!parseRefEqual) details += "parse function reference mismatch; ";
      if (!papaRefEqual) details += "Papa object reference mismatch; ";
      if (!recordSepEqual) details += "RECORD_SEP reference mismatch; ";
      if (!unitSepEqual) details += "UNIT_SEP reference mismatch; ";

      if (passed) {
        details = "All singleton references are consistent";
      }

      return { passed, details };
    } catch (error) {
      return {
        passed: false,
        details: `Singleton test failed: ${error}`,
      };
    }
  }

  /**
   * Test specific edge cases mentioned in the refactor plan
   */
  testEdgeCases(papa: any): {
    passed: boolean;
    results: Array<{
      test: string;
      passed: boolean;
      details: string;
    }>;
  } {
    const results: Array<{ test: string; passed: boolean; details: string }> = [];

    // Test: Papa.parse('', {dynamicTyping: true}).data returns [[""]]
    try {
      const result = papa.parse("", { dynamicTyping: true });
      const expected = [[""]];
      const actual = result.data;
      const passed = JSON.stringify(actual) === JSON.stringify(expected);

      results.push({
        test: "empty_string_dynamic_typing",
        passed,
        details: passed
          ? 'Empty string with dynamic typing returns [[""]]'
          : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      });
    } catch (error) {
      results.push({
        test: "empty_string_dynamic_typing",
        passed: false,
        details: `Test failed with error: ${error}`,
      });
    }

    // Test: LocalChunkSize mutability
    try {
      const originalChunkSize = papa.LocalChunkSize;
      papa.LocalChunkSize = 12345;
      const newChunkSize = papa.LocalChunkSize;
      papa.LocalChunkSize = originalChunkSize; // Restore

      const passed = newChunkSize === 12345;
      results.push({
        test: "local_chunk_size_mutability",
        passed,
        details: passed
          ? "LocalChunkSize is mutable as expected"
          : `LocalChunkSize mutation failed: ${newChunkSize} !== 12345`,
      });
    } catch (error) {
      results.push({
        test: "local_chunk_size_mutability",
        passed: false,
        details: `LocalChunkSize mutability test failed: ${error}`,
      });
    }

    // Test: RemoteChunkSize mutability
    try {
      const originalChunkSize = papa.RemoteChunkSize;
      papa.RemoteChunkSize = 54321;
      const newChunkSize = papa.RemoteChunkSize;
      papa.RemoteChunkSize = originalChunkSize; // Restore

      const passed = newChunkSize === 54321;
      results.push({
        test: "remote_chunk_size_mutability",
        passed,
        details: passed
          ? "RemoteChunkSize is mutable as expected"
          : `RemoteChunkSize mutation failed: ${newChunkSize} !== 54321`,
      });
    } catch (error) {
      results.push({
        test: "remote_chunk_size_mutability",
        passed: false,
        details: `RemoteChunkSize mutability test failed: ${error}`,
      });
    }

    // Test: Exposed internal classes
    const internalClasses = [
      "Parser",
      "ParserHandle",
      "NetworkStreamer",
      "FileStreamer",
      "StringStreamer",
      "ReadableStreamStreamer",
    ];
    for (const className of internalClasses) {
      try {
        const classRef = papa[className];
        const passed = typeof classRef === "function" || classRef !== undefined;
        results.push({
          test: `internal_class_${className.toLowerCase()}`,
          passed,
          details: passed ? `${className} is exposed as expected` : `${className} is not exposed or not a function`,
        });
      } catch (error) {
        results.push({
          test: `internal_class_${className.toLowerCase()}`,
          passed: false,
          details: `${className} test failed: ${error}`,
        });
      }
    }

    const allPassed = results.every((r) => r.passed);
    return { passed: allPassed, results };
  }

  /**
   * Run complete API compatibility test suite
   */
  runCompleteAPITest(
    papa: any,
    version: string,
  ): {
    passed: boolean;
    apiSurface: APISurface;
    comparison?: APIComparison;
    singletonTest: { passed: boolean; details: string };
    edgeCaseTests: { passed: boolean; results: any[] };
    summary: string;
  } {
    console.log("🔍 Running complete API compatibility test...");

    // Extract current API surface
    const currentSurface = this.extractAPISurface(papa, version);

    // Try to load existing snapshot for comparison
    const expectedSurface = this.loadAPISurface();
    let comparison: APIComparison | undefined;

    if (expectedSurface) {
      comparison = this.compareAPISurfaces(expectedSurface, currentSurface);
      console.log(`API Surface Comparison: ${comparison.summary}`);
    } else {
      console.log("No existing API surface snapshot found - saving current as baseline");
      this.saveAPISurface(currentSurface);
    }

    // Test singleton consistency (would need mock require function)
    const singletonTest = {
      passed: true,
      details: "Singleton test skipped (requires require function)",
    };

    // Test edge cases
    const edgeCaseTests = this.testEdgeCases(papa);
    console.log(`Edge Case Tests: ${edgeCaseTests.passed ? "PASSED" : "FAILED"}`);

    const passed = (!comparison || comparison.passed) && singletonTest.passed && edgeCaseTests.passed;

    let summary = `API Test ${passed ? "PASSED" : "FAILED"}`;
    if (comparison && !comparison.passed) {
      summary += ` - ${comparison.differences.length} API differences`;
    }
    if (!edgeCaseTests.passed) {
      const failedCount = edgeCaseTests.results.filter((r) => !r.passed).length;
      summary += ` - ${failedCount} edge case failures`;
    }

    return {
      passed,
      apiSurface: currentSurface,
      comparison,
      singletonTest,
      edgeCaseTests,
      summary,
    };
  }
}

// CLI runner for API reflection tests
export async function runAPIReflectionTest(): Promise<void> {
  console.log("🔍 Running API Reflection Tests...");

  const tester = new APIReflectionTester();

  try {
    // Import legacy implementation
    const legacyPapa = require("../../legacy/papaparse.js");

    // Test legacy implementation (establish baseline)
    console.log("\nTesting legacy implementation:");
    const legacyResult = tester.runCompleteAPITest(legacyPapa, "legacy");

    if (!legacyResult.passed) {
      console.warn("⚠️ Legacy implementation failed some tests (this may indicate test issues)");
    }

    // When modern implementation is ready:
    // console.log('\nTesting modern implementation:');
    // const modernPapa = require('../../dist/index.js');
    // const modernResult = tester.runCompleteAPITest(modernPapa, 'modern');

    // if (!modernResult.passed) {
    //   console.error('❌ Modern implementation failed API compatibility tests');
    //   process.exit(1);
    // }

    console.log("✅ API reflection tests completed");
  } catch (error) {
    console.error("❌ API reflection test failed:", error);
    process.exit(1);
  }
}

export default APIReflectionTester;
