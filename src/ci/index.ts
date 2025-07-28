#!/usr/bin/env node

/**
 * CI Testing Suite Runner
 *
 * Main entry point for all CI testing infrastructure including:
 * - Performance benchmarks
 * - Golden output snapshots
 * - API surface reflection testing
 */

import { runAPIReflectionTest } from "./api-reflection";
import {
  runSnapshotGeneration,
  runSnapshotValidation,
} from "./golden-snapshots";
import { runCIBenchmark } from "./performance-benchmark";

// Command line interface
const command = process.argv[2];

async function main() {
  console.log("🚀 PapaParse V6 Refactor - CI Testing Suite");
  console.log("=".repeat(50));

  switch (command) {
    case "benchmark":
      console.log("Running performance benchmarks...");
      await runCIBenchmark();
      break;

    case "generate-snapshots":
      console.log("Generating golden snapshots from legacy implementation...");
      await runSnapshotGeneration();
      break;

    case "validate-snapshots":
      console.log("Validating against golden snapshots...");
      await runSnapshotValidation();
      break;

    case "api-test":
      console.log("Running API reflection tests...");
      await runAPIReflectionTest();
      break;

    case "all":
      console.log("Running complete CI test suite...");
      try {
        console.log("\n1. Generating snapshots...");
        await runSnapshotGeneration();

        console.log("\n2. Validating snapshots...");
        await runSnapshotValidation();

        console.log("\n3. Running API tests...");
        await runAPIReflectionTest();

        console.log("\n4. Running benchmarks...");
        await runCIBenchmark();

        console.log("\n✅ All CI tests completed successfully!");
      } catch (error) {
        console.error("\n❌ CI test suite failed:", error);
        process.exit(1);
      }
      break;

    case "foundation":
      console.log("Testing foundation infrastructure only...");
      try {
        console.log("\n1. Testing TypeScript compilation...");
        await testTypeScriptCompilation();

        console.log("\n2. Testing utility functions...");
        await testUtilityFunctions();

        console.log("\n3. Testing constants...");
        await testConstants();

        console.log("\n✅ Foundation tests completed successfully!");
      } catch (error) {
        console.error("\n❌ Foundation tests failed:", error);
        process.exit(1);
      }
      break;

    default:
      console.log("Usage: bun run ci <command>");
      console.log("");
      console.log("Commands:");
      console.log("  benchmark           - Run performance benchmarks");
      console.log(
        "  generate-snapshots  - Generate golden snapshots from legacy",
      );
      console.log(
        "  validate-snapshots  - Validate current implementation against snapshots",
      );
      console.log("  api-test           - Run API surface reflection tests");
      console.log("  all                - Run complete CI test suite");
      console.log("  foundation         - Test foundation infrastructure only");
      console.log("");
      console.log("Examples:");
      console.log("  bun run ci foundation        # Test basic infrastructure");
      console.log(
        "  bun run ci generate-snapshots # Create baseline snapshots",
      );
      console.log("  bun run ci all              # Full CI suite");
      process.exit(1);
  }
}

/**
 * Test TypeScript compilation
 */
async function testTypeScriptCompilation(): Promise<void> {
  const { spawn } = require("child_process");

  return new Promise((resolve, reject) => {
    const tsc = spawn("npx", ["tsc", "--noEmit"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });

    tsc.on("close", (code: number) => {
      if (code === 0) {
        console.log("✅ TypeScript compilation successful");
        resolve();
      } else {
        reject(new Error(`TypeScript compilation failed with code ${code}`));
      }
    });

    tsc.on("error", (error: Error) => {
      reject(new Error(`Failed to run TypeScript compiler: ${error.message}`));
    });
  });
}

/**
 * Test utility functions
 */
async function testUtilityFunctions(): Promise<void> {
  const {
    copy,
    isFunction,
    stripBom,
    escapeRegExp,
    isString,
    isNumber,
    isArray,
  } = await import("../utils");

  // Test copy function
  const testObj = { a: 1, b: { c: 2 } };
  const copied = copy(testObj);
  if (copied.b.c !== 2 || copied === testObj) {
    throw new Error("copy function test failed");
  }

  // Test isFunction
  if (!isFunction(() => {}) || isFunction("not a function")) {
    throw new Error("isFunction test failed");
  }

  // Test stripBom
  const bomString = "\ufeffHello";
  if (stripBom(bomString) !== "Hello") {
    throw new Error("stripBom test failed");
  }

  // Test escapeRegExp
  const escaped = escapeRegExp("Hello (world)");
  if (escaped !== "Hello \\(world\\)") {
    throw new Error("escapeRegExp test failed");
  }

  // Test type guards
  if (!isString("hello") || !isNumber(42) || !isArray([])) {
    throw new Error("Type guard tests failed");
  }

  console.log("✅ Utility functions tests passed");
}

/**
 * Test constants
 */
async function testConstants(): Promise<void> {
  const { CONSTANTS, DEFAULT_DELIMITERS_TO_GUESS, ERROR_TYPES } = await import(
    "../constants"
  );

  // Test constants exist and have expected values
  if (CONSTANTS.RECORD_SEP !== String.fromCharCode(30)) {
    throw new Error("RECORD_SEP constant incorrect");
  }

  if (CONSTANTS.UNIT_SEP !== String.fromCharCode(31)) {
    throw new Error("UNIT_SEP constant incorrect");
  }

  if (CONSTANTS.DefaultDelimiter !== ",") {
    throw new Error("DefaultDelimiter constant incorrect");
  }

  // Test mutability of chunk sizes
  const originalSize = CONSTANTS.LocalChunkSize;
  CONSTANTS.LocalChunkSize = 12345;
  if (CONSTANTS.LocalChunkSize !== 12345) {
    throw new Error("LocalChunkSize is not mutable");
  }
  CONSTANTS.LocalChunkSize = originalSize; // Restore

  // Test default delimiters array
  if (
    !Array.isArray(DEFAULT_DELIMITERS_TO_GUESS) ||
    !DEFAULT_DELIMITERS_TO_GUESS.includes(",")
  ) {
    throw new Error("DEFAULT_DELIMITERS_TO_GUESS incorrect");
  }

  // Test error types
  if (
    ERROR_TYPES.Quotes !== "Quotes" ||
    ERROR_TYPES.Delimiter !== "Delimiter"
  ) {
    throw new Error("ERROR_TYPES constants incorrect");
  }

  console.log("✅ Constants tests passed");
}

// Run the CLI
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ CI suite failed:", error);
    process.exit(1);
  });
}

export { testTypeScriptCompilation, testUtilityFunctions, testConstants };
