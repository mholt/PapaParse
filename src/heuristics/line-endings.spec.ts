/**
 * Unit tests for line ending detection functionality
 * Tests line ending format detection and quoted text handling
 */

import { describe, expect, mock, test } from "bun:test";
import { detectLineEndings, guessLineEndings } from "./line-endings";

// Mock utils
mock.module("../utils/index.js", () => ({
  escapeRegExp: mock((str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
}));

describe("guessLineEndings", () => {
  test("detects \\n line endings", () => {
    const input = "line1\nline2\nline3";
    expect(guessLineEndings(input)).toBe("\n");
  });

  test("detects \\r line endings", () => {
    const input = "line1\rline2\rline3";
    expect(guessLineEndings(input)).toBe("\r");
  });

  test("detects \\r\\n line endings", () => {
    const input = "line1\r\nline2\r\nline3";
    expect(guessLineEndings(input)).toBe("\r\n");
  });

  test("prefers \\n when no \\r found", () => {
    const input = "line1\nline2\nline3";
    expect(guessLineEndings(input)).toBe("\n");
  });

  test("prefers \\n when \\n appears before \\r", () => {
    const input = "line1\nline2\rline3";
    expect(guessLineEndings(input)).toBe("\n");
  });

  test("handles mixed line endings with majority \\r\\n", () => {
    const input = "line1\r\nline2\r\nline3\rline4";
    expect(guessLineEndings(input)).toBe("\r\n");
  });

  test("handles mixed line endings with majority \\r", () => {
    const input = "line1\rline2\rline3\r\nline4";
    expect(guessLineEndings(input)).toBe("\r");
  });

  test("ignores line endings inside quoted text", () => {
    const input = 'field1,"text with\r\nlinebreak",field3\nline2,field2,field3';
    expect(guessLineEndings(input)).toBe("\n");
  });

  test("ignores line endings inside quoted text with custom quote char", () => {
    const input = "field1,'text with\r\nlinebreak',field3\nline2,field2,field3";
    expect(guessLineEndings(input, "'")).toBe("\n");
  });

  test("handles multiple quoted sections", () => {
    const input = 'field1,"first\r\nquote","second\r\nquote"\nline2,field2,field3';
    expect(guessLineEndings(input)).toBe("\n");
  });

  test("handles empty string", () => {
    const input = "";
    expect(guessLineEndings(input)).toBe("\n");
  });

  test("handles single line without line endings", () => {
    const input = "single line";
    expect(guessLineEndings(input)).toBe("\n");
  });

  test("handles only \\r characters", () => {
    const input = "line1\rline2\rline3\r";
    expect(guessLineEndings(input)).toBe("\r");
  });

  test("handles only \\n characters", () => {
    const input = "line1\nline2\nline3\n";
    expect(guessLineEndings(input)).toBe("\n");
  });

  test("limits analysis to first 1MB", () => {
    const largeLine = "a".repeat(500000);
    const input = largeLine + "\r\n" + largeLine + "\r\n" + largeLine + "\n"; // > 1MB
    // Should analyze only first 1MB and detect \r\n
    expect(guessLineEndings(input)).toBe("\r\n");
  });

  test("handles edge case with \\r followed by \\n ratio exactly 50%", () => {
    const input = "a\r\nb\rc\r\nd\r"; // 2 \r\n out of 4 \r = exactly 50%
    expect(guessLineEndings(input)).toBe("\r"); // Actually returns \r since 50% is not >= 50%
  });

  test("handles escaped quote characters", () => {
    const { escapeRegExp } = require("../utils/index.js");
    escapeRegExp.mockReturnValue('\\"');

    const input = 'field1,"\\"escaped\r\nquote\\"",field3\nline2';
    expect(guessLineEndings(input)).toBe("\r\n"); // The \r\n inside quotes still gets detected
  });

  test("handles text with only quotes", () => {
    const input = '""""""';
    expect(guessLineEndings(input)).toBe("\n");
  });

  test("handles alternating quote patterns", () => {
    const input = '"text1"\r\n"text2"\r\n"text3"';
    expect(guessLineEndings(input)).toBe("\r\n");
  });

  test("handles unmatched quotes", () => {
    const input = 'field1,"unmatched quote\r\nfield2,field3\nline2';
    expect(guessLineEndings(input)).toBe("\r\n"); // Unmatched quotes means content isn't ignored
  });
});

describe("detectLineEndings", () => {
  test("detects LF only", () => {
    const input = "line1\nline2\nline3";
    const result = detectLineEndings(input);

    expect(result.hasLF).toBe(true);
    expect(result.hasCR).toBe(false);
    expect(result.hasCRLF).toBe(false);
    expect(result.primary).toBe("\n");
  });

  test("detects CR only", () => {
    const input = "line1\rline2\rline3";
    const result = detectLineEndings(input);

    expect(result.hasLF).toBe(false);
    expect(result.hasCR).toBe(true);
    expect(result.hasCRLF).toBe(false);
    expect(result.primary).toBe("\r");
  });

  test("detects CRLF only", () => {
    const input = "line1\r\nline2\r\nline3";
    const result = detectLineEndings(input);

    expect(result.hasLF).toBe(true);
    expect(result.hasCR).toBe(true);
    expect(result.hasCRLF).toBe(true);
    expect(result.primary).toBe("\r\n");
  });

  test("detects mixed line endings", () => {
    const input = "line1\r\nline2\nline3\rline4";
    const result = detectLineEndings(input);

    expect(result.hasLF).toBe(true);
    expect(result.hasCR).toBe(true);
    expect(result.hasCRLF).toBe(true);
    expect(result.primary).toBe("\r\n");
  });

  test("prioritizes CRLF when present", () => {
    const input = "line1\nline2\r\nline3";
    const result = detectLineEndings(input);

    expect(result.hasLF).toBe(true);
    expect(result.hasCR).toBe(true);
    expect(result.hasCRLF).toBe(true);
    expect(result.primary).toBe("\r\n");
  });

  test("prioritizes LF over CR when no CRLF", () => {
    const input = "line1\nline2\rline3";
    const result = detectLineEndings(input);

    expect(result.hasLF).toBe(true);
    expect(result.hasCR).toBe(true);
    expect(result.hasCRLF).toBe(false);
    expect(result.primary).toBe("\n");
  });

  test("defaults to LF when no line endings found", () => {
    const input = "single line";
    const result = detectLineEndings(input);

    expect(result.hasLF).toBe(false);
    expect(result.hasCR).toBe(false);
    expect(result.hasCRLF).toBe(false);
    expect(result.primary).toBe("\n");
  });

  test("handles empty string", () => {
    const input = "";
    const result = detectLineEndings(input);

    expect(result.hasLF).toBe(false);
    expect(result.hasCR).toBe(false);
    expect(result.hasCRLF).toBe(false);
    expect(result.primary).toBe("\n");
  });

  test("detects single CR", () => {
    const input = "line1\rline2";
    const result = detectLineEndings(input);

    expect(result.hasLF).toBe(false);
    expect(result.hasCR).toBe(true);
    expect(result.hasCRLF).toBe(false);
    expect(result.primary).toBe("\r");
  });

  test("detects single LF", () => {
    const input = "line1\nline2";
    const result = detectLineEndings(input);

    expect(result.hasLF).toBe(true);
    expect(result.hasCR).toBe(false);
    expect(result.hasCRLF).toBe(false);
    expect(result.primary).toBe("\n");
  });

  test("detects single CRLF", () => {
    const input = "line1\r\nline2";
    const result = detectLineEndings(input);

    expect(result.hasLF).toBe(true);
    expect(result.hasCR).toBe(true);
    expect(result.hasCRLF).toBe(true);
    expect(result.primary).toBe("\r\n");
  });
});
