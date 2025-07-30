/**
 * Unit tests for delimiter guessing functionality
 * Tests delimiter detection logic and field count consistency analysis
 */

import { describe, expect, mock, test } from "bun:test";
import { guessDelimiter } from "./guess-delimiter";

// Mock dependencies
const mockParser = {
  parse: mock(() => ({ data: [] })),
};

mock.module("../core/parser.js", () => ({
  Parser: mock((config) => ({
    parse: (input) => mockParser.parse(input, config),
  })),
}));

mock.module("../constants/index.js", () => ({
  CONSTANTS: {
    RECORD_SEP: String.fromCharCode(30),
    UNIT_SEP: String.fromCharCode(31),
  },
}));

describe("guessDelimiter", () => {
  test("returns unsuccessful result for empty data", () => {
    mockParser.parse.mockReturnValue({ data: [] });

    const result = guessDelimiter("test");

    expect(result.successful).toBe(false);
    expect(result.bestDelimiter).toBeUndefined();
  });

  test("detects comma delimiter", () => {
    mockParser.parse.mockImplementation((input, config) => {
      if (config && config.delimiter === ",") {
        return {
          data: [
            ["a", "b", "c"],
            ["1", "2", "3"],
          ],
        };
      }
      return { data: [["a,b,c"], ["1,2,3"]] };
    });

    const result = guessDelimiter("a,b,c\n1,2,3");

    expect(result.successful).toBe(true);
    expect(result.bestDelimiter).toBe(",");
  });

  test("detects tab delimiter", () => {
    mockParser.parse.mockImplementation((input, config) => {
      if (config && config.delimiter === "\t") {
        return {
          data: [
            ["a", "b", "c"],
            ["1", "2", "3"],
          ],
        };
      }
      return { data: [["a\tb\tc"], ["1\t2\t3"]] };
    });

    const result = guessDelimiter("a\tb\tc\n1\t2\t3");

    expect(result.successful).toBe(true);
    expect(result.bestDelimiter).toBe("\t");
  });

  test("detects pipe delimiter", () => {
    mockParser.parse.mockImplementation((input, config) => {
      if (config && config.delimiter === "|") {
        return {
          data: [
            ["a", "b", "c"],
            ["1", "2", "3"],
          ],
        };
      }
      return { data: [["a|b|c"], ["1|2|3"]] };
    });

    const result = guessDelimiter("a|b|c\n1|2|3");

    expect(result.successful).toBe(true);
    expect(result.bestDelimiter).toBe("|");
  });

  test("detects semicolon delimiter", () => {
    mockParser.parse.mockImplementation((input, config) => {
      if (config && config.delimiter === ";") {
        return {
          data: [
            ["a", "b", "c"],
            ["1", "2", "3"],
          ],
        };
      }
      return { data: [["a;b;c"], ["1;2;3"]] };
    });

    const result = guessDelimiter("a;b;c\n1;2;3");

    expect(result.successful).toBe(true);
    expect(result.bestDelimiter).toBe(";");
  });

  test("prefers delimiter with higher field count", () => {
    mockParser.parse.mockImplementation((input, config) => {
      if (config && config.delimiter === ",") {
        return {
          data: [
            ["a", "b", "c", "d"],
            ["1", "2", "3", "4"],
          ],
        }; // 4 fields
      }
      if (config && config.delimiter === "|") {
        return {
          data: [
            ["a", "b"],
            ["1", "2"],
          ],
        }; // 2 fields
      }
      return { data: [["single"]] };
    });

    const result = guessDelimiter("a,b,c,d\n1,2,3,4");

    expect(result.successful).toBe(true);
    expect(result.bestDelimiter).toBe(",");
  });

  test("prefers delimiter with lower delta (more consistent)", () => {
    mockParser.parse.mockImplementation((input, config) => {
      if (config && config.delimiter === ",") {
        return {
          data: [
            ["a", "b"],
            ["1", "2"],
            ["x", "y"],
          ],
        }; // Consistent 2 fields
      }
      if (config && config.delimiter === "|") {
        return { data: [["a", "b"], ["1"], ["x", "y", "z"]] }; // Inconsistent: 2, 1, 3 fields
      }
      return { data: [["single"]] };
    });

    const result = guessDelimiter("test");

    expect(result.successful).toBe(true);
    expect(result.bestDelimiter).toBe(",");
  });

  test("requires average field count > 1.99", () => {
    mockParser.parse.mockImplementation((input) => {
      return { data: [["single"], ["field"]] }; // Only 1 field per row
    });

    const result = guessDelimiter("single\nfield");

    expect(result.successful).toBe(false);
    expect(result.bestDelimiter).toBeUndefined();
  });

  test("handles custom delimiters list", () => {
    mockParser.parse.mockImplementation((input, config) => {
      if (config && config.delimiter === "::") {
        return {
          data: [
            ["a", "b"],
            ["1", "2"],
          ],
        };
      }
      return { data: [["a::b"], ["1::2"]] };
    });

    const result = guessDelimiter("a::b\n1::2", { delimitersToGuess: ["::", "||"] });

    expect(result.successful).toBe(true);
    expect(result.bestDelimiter).toBe("::");
  });

  test("skips empty lines when skipEmptyLines is true", () => {
    mockParser.parse.mockImplementation((input, config) => {
      if (config && config.delimiter === ",") {
        return { data: [["a", "b"], [""], ["1", "2"]] }; // Middle row is empty
      }
      return { data: [["a,b"], [""], ["1,2"]] };
    });

    const result = guessDelimiter("a,b\n\n1,2", { skipEmptyLines: true });

    expect(result.successful).toBe(true);
    expect(result.bestDelimiter).toBe(",");
  });

  test("skips greedy empty lines when skipEmptyLines is 'greedy'", () => {
    mockParser.parse.mockImplementation((input, config) => {
      if (config && config.delimiter === ",") {
        return {
          data: [
            ["a", "b"],
            ["", ""],
            ["1", "2"],
          ],
        }; // Middle row has empty strings
      }
      return { data: [["a,b"], [","], ["1,2"]] };
    });

    const result = guessDelimiter("a,b\n,\n1,2", { skipEmptyLines: "greedy" });

    expect(result.successful).toBe(true);
    expect(result.bestDelimiter).toBe(",");
  });

  test("passes configuration options to parser", () => {
    mockParser.parse.mockReturnValue({
      data: [
        ["a", "b"],
        ["1", "2"],
      ],
    });

    // Test that the Parser constructor receives the config
    const { Parser } = require("../core/parser.js");
    guessDelimiter("a,b\n1,2", { newline: "\r\n", comments: "#" });

    expect(Parser).toHaveBeenCalledWith(
      expect.objectContaining({
        newline: "\r\n",
        comments: "#",
        preview: 10,
      }),
    );
  });

  test("handles zero field count rows", () => {
    mockParser.parse.mockImplementation((input, config) => {
      if (config && config.delimiter === ",") {
        // Total fields: 2 + 0 + 2 = 4, divided by 3 rows = 1.33 avg (below threshold)
        // Let's provide more rows with enough fields to exceed threshold
        return { data: [["a", "b"], [], ["1", "2"], ["x", "y"]] }; // avg = 6/4 = 1.5 still too low
      }
      return { data: [["single"]] };
    });

    const result = guessDelimiter("a,b\n\n1,2");

    // With avg 1.5, this should still fail the >1.99 requirement
    expect(result.successful).toBe(false);
    expect(result.bestDelimiter).toBeUndefined();
  });

  test("calculates average field count correctly", () => {
    mockParser.parse.mockImplementation((input, config) => {
      if (config && config.delimiter === ",") {
        // 3 rows: 2 fields, 3 fields, 1 field = avg 2.0 fields
        return { data: [["a", "b"], ["1", "2", "3"], ["x"]] };
      }
      return { data: [["single"]] };
    });

    const result = guessDelimiter("test");

    expect(result.successful).toBe(true);
    expect(result.bestDelimiter).toBe(",");
  });

  test("handles all default delimiter options", () => {
    mockParser.parse.mockReturnValue({ data: [["single"]] });

    const result = guessDelimiter("single");

    // Should test all default delimiters: ",", "\t", "|", ";", RECORD_SEP, UNIT_SEP
    expect(mockParser.parse.mock.calls.length).toBeGreaterThanOrEqual(6);
  });
});
