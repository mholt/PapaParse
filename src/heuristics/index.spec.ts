/**
 * Unit tests for heuristics module exports
 * Tests that all heuristics functions are properly exported
 */

import { describe, expect, test } from "bun:test";
import * as heuristics from "./index";

describe("heuristics index", () => {
  test("exports dynamic typing functions", () => {
    expect(heuristics.shouldApplyDynamicTyping).toBeDefined();
    expect(heuristics.parseDynamic).toBeDefined();
    expect(heuristics.transformField).toBeDefined();
    expect(typeof heuristics.shouldApplyDynamicTyping).toBe("function");
    expect(typeof heuristics.parseDynamic).toBe("function");
    expect(typeof heuristics.transformField).toBe("function");
  });

  test("exports delimiter guessing functions", () => {
    expect(heuristics.guessDelimiter).toBeDefined();
    expect(typeof heuristics.guessDelimiter).toBe("function");
  });

  test("exports line ending functions", () => {
    expect(heuristics.guessLineEndings).toBeDefined();
    expect(heuristics.detectLineEndings).toBeDefined();
    expect(typeof heuristics.guessLineEndings).toBe("function");
    expect(typeof heuristics.detectLineEndings).toBe("function");
  });

  test("exports all expected functions", () => {
    const expectedExports = [
      "shouldApplyDynamicTyping",
      "parseDynamic",
      "transformField",
      "guessDelimiter",
      "guessLineEndings",
      "detectLineEndings",
    ];

    for (const exportName of expectedExports) {
      expect(heuristics).toHaveProperty(exportName);
      expect(typeof (heuristics as any)[exportName]).toBe("function");
    }
  });

  test("does not export unexpected properties", () => {
    const exports = Object.keys(heuristics);
    const expectedExports = [
      "shouldApplyDynamicTyping",
      "parseDynamic",
      "transformField",
      "guessDelimiter",
      "guessLineEndings",
      "detectLineEndings",
    ];

    // Check that we don't have any unexpected exports
    for (const exportName of exports) {
      expect(expectedExports).toContain(exportName);
    }
  });
});
