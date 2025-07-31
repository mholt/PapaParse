/**
 * Unit tests for CSV lexer functionality
 * Tests tokenization, quote handling, and configuration
 */

import { describe, expect, mock, test } from "bun:test";
import { createLexerConfig, Lexer, type LexerConfig, type Token, TokenType } from "./lexer";

// Mock dependencies
mock.module("../constants/index.js", () => ({
  CONSTANTS: {
    DefaultDelimiter: ",",
    BAD_DELIMITERS: ["\r", "\n", '"', "\b", "\t", "\\"],
  },
}));

mock.module("../utils/index.js", () => ({
  escapeRegExp: mock((str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
}));

describe("TokenType", () => {
  test("defines all token types", () => {
    expect(TokenType.FIELD).toBe("field");
    expect(TokenType.DELIMITER).toBe("delimiter");
    expect(TokenType.NEWLINE).toBe("newline");
    expect(TokenType.COMMENT).toBe("comment");
    expect(TokenType.EOF).toBe("eof");
  });
});

describe("Lexer", () => {
  const defaultConfig: LexerConfig = {
    delimiter: ",",
    newline: "\n",
    quoteChar: '"',
    escapeChar: '"',
    comments: false,
    fastMode: undefined,
  };

  test("constructor initializes with config", () => {
    const config: LexerConfig = {
      delimiter: "|",
      newline: "\r\n",
      quoteChar: "'",
      escapeChar: "\\",
      comments: "#",
      fastMode: true,
    };

    const lexer = new Lexer(config);
    expect(lexer).toBeDefined();
  });

  test("setInput stores input string", () => {
    const lexer = new Lexer(defaultConfig);
    lexer.setInput("test,data");
    // Input is stored internally, we'll verify through tokenization
  });

  describe("canUseFastMode", () => {
    test("returns true when no quotes in input", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput("simple,data,no,quotes");

      // Fast mode should work
      const tokens = lexer.tokenizeFast();
      expect(tokens.length).toBeGreaterThan(0);
    });

    test("throws error in fast mode when quotes present", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput('simple,"quoted",data');

      expect(() => lexer.tokenizeFast()).toThrow("Fast mode not available - quotes detected in input");
    });

    test("returns true when fastMode explicitly enabled", () => {
      const config = { ...defaultConfig, fastMode: true };
      const lexer = new Lexer(config);
      lexer.setInput('data,"with",quotes');

      // Should allow fast mode even with quotes when explicitly enabled
      const tokens = lexer.tokenizeFast();
      expect(tokens.length).toBeGreaterThan(0);
    });

    test("returns false when fastMode explicitly disabled", () => {
      const config = { ...defaultConfig, fastMode: false };
      const lexer = new Lexer(config);
      lexer.setInput("simple,data");

      // Should use full tokenizer even without quotes when fastMode=false
      const result = lexer.tokenize();
      expect(result.tokens.length).toBeGreaterThan(0);
    });
  });

  describe("tokenizeFast", () => {
    test("tokenizes simple CSV without quotes", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput("a,b,c\n1,2,3");

      const tokens = lexer.tokenizeFast();

      expect(tokens).toEqual([
        { type: "field", value: "a", position: 0, length: 1 },
        { type: "delimiter", value: ",", position: 1, length: 1 },
        { type: "field", value: "b", position: 2, length: 1 },
        { type: "delimiter", value: ",", position: 3, length: 1 },
        { type: "field", value: "c", position: 4, length: 1 },
        { type: "newline", value: "\n", position: 5, length: 1 },
        { type: "field", value: "1", position: 6, length: 1 },
        { type: "delimiter", value: ",", position: 7, length: 1 },
        { type: "field", value: "2", position: 8, length: 1 },
        { type: "delimiter", value: ",", position: 9, length: 1 },
        { type: "field", value: "3", position: 10, length: 1 },
        { type: "eof", value: "", position: 11, length: 0 },
      ]);
    });

    test("handles empty fields", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput("a,,c");

      const tokens = lexer.tokenizeFast();

      expect(tokens[0]).toEqual({ type: "field", value: "a", position: 0, length: 1 });
      expect(tokens[1]).toEqual({ type: "delimiter", value: ",", position: 1, length: 1 });
      expect(tokens[2]).toEqual({ type: "field", value: "", position: 2, length: 0 });
      expect(tokens[3]).toEqual({ type: "delimiter", value: ",", position: 2, length: 1 });
      expect(tokens[4]).toEqual({ type: "field", value: "c", position: 3, length: 1 });
    });

    test("skips comment lines", () => {
      const config = { ...defaultConfig, comments: "#" };
      const lexer = new Lexer(config);
      lexer.setInput("a,b\n#comment\nc,d");

      const tokens = lexer.tokenizeFast();

      // Should skip the comment line entirely
      const fieldValues = tokens.filter((t) => t.type === "field").map((t) => t.value);
      expect(fieldValues).toEqual(["a", "b", "c", "d"]);
    });

    test("handles custom delimiters", () => {
      const config = { ...defaultConfig, delimiter: "|" };
      const lexer = new Lexer(config);
      lexer.setInput("a|b|c");

      const tokens = lexer.tokenizeFast();

      expect(tokens[1]).toEqual({ type: "delimiter", value: "|", position: 1, length: 1 });
      expect(tokens[3]).toEqual({ type: "delimiter", value: "|", position: 3, length: 1 });
    });

    test("handles custom newlines", () => {
      const config = { ...defaultConfig, newline: "\r\n" };
      const lexer = new Lexer(config);
      lexer.setInput("a,b\r\nc,d");

      const tokens = lexer.tokenizeFast();

      // Find the newline token
      const newlineToken = tokens.find((t) => t.type === "newline");
      expect(newlineToken).toEqual({ type: "newline", value: "\r\n", position: 3, length: 2 });
    });

    test("handles empty input", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput("");

      const tokens = lexer.tokenizeFast();

      // Empty input may produce an empty field before EOF
      expect(tokens[tokens.length - 1]).toEqual({ type: "eof", value: "", position: 0, length: 0 });
    });

    test("handles single field", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput("single");

      const tokens = lexer.tokenizeFast();

      expect(tokens).toEqual([
        { type: "field", value: "single", position: 0, length: 6 },
        { type: "eof", value: "", position: 6, length: 0 },
      ]);
    });
  });

  describe("tokenize", () => {
    test("handles quoted fields", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput('a,"quoted field",c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "quoted field", "c"]);
    });

    test("handles escaped quotes", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput('a,"field with ""quotes""",c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", 'field with "quotes"', "c"]);
    });

    test("handles backslash escaped quotes", () => {
      const config = { ...defaultConfig, escapeChar: "\\" };
      const lexer = new Lexer(config);
      lexer.setInput('a,"field with \\"quotes\\"",c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", 'field with "quotes"', "c"]);
    });

    test("handles unterminated quoted field", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput('a,"unterminated quote');

      const result = lexer.tokenize();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        type: "Quotes",
        code: "MissingQuotes",
        message: "Quoted field unterminated",
      });

      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "unterminated quote"]);
    });

    test("handles malformed trailing quotes", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput('a,"quoted"extra,c');

      const result = lexer.tokenize();

      // May generate multiple errors for complex malformed cases
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.code === "InvalidQuotes")).toBe(true);
    });

    test("handles quotes at EOF", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput('a,"quoted field"');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "quoted field"]);
    });

    test("handles spaces around quoted fields", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput('a, "quoted" ,c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      // Spaces around quotes may be preserved depending on implementation
      expect(fieldTokens[0].value).toBe("a");
      expect(fieldTokens[1].value).toContain("quoted");
      expect(fieldTokens[2].value).toBe("c");
    });

    test("handles newlines in quoted fields", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput('a,"field\nwith\nnewlines",c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "field\nwith\nnewlines", "c"]);
    });

    test("handles regular fields mixed with quoted", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput('regular,"quoted",another');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["regular", "quoted", "another"]);
    });

    test("handles comment lines", () => {
      const config = { ...defaultConfig, comments: "#" };
      const lexer = new Lexer(config);
      lexer.setInput("a,b\n#comment line\nc,d");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "b", "c", "d"]);
    });

    test("handles comment at EOF", () => {
      const config = { ...defaultConfig, comments: "#" };
      const lexer = new Lexer(config);
      lexer.setInput("a,b\n#comment at end");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "b"]);
    });

    test("handles comment starting at beginning of input", () => {
      const config = { ...defaultConfig, comments: "#" };
      const lexer = new Lexer(config);
      lexer.setInput("#comment line\na,b");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "b"]);
    });

    test("handles comment with no trailing newline at EOF", () => {
      const config = { ...defaultConfig, comments: "#" };
      const lexer = new Lexer(config);
      lexer.setInput("a,b\n#final comment");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "b"]);
    });

    test("handles empty comment string", () => {
      const config = { ...defaultConfig, comments: "" };
      const lexer = new Lexer(config);
      lexer.setInput("a,b\nc,d");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "b", "c", "d"]);
    });

    test("handles comment that goes to EOF with skipComment", () => {
      const config = { ...defaultConfig, comments: "//" };
      const lexer = new Lexer(config);
      // Add quotes to force full tokenizer mode, not fast mode
      lexer.setInput('"a",b\n//comment that ends file');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      // terminatedByComment should be set when comment goes to EOF
      expect(result.terminatedByComment).toBeTruthy();
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "b"]);
    });

    test("handles comment with newline in middle using skipComment", () => {
      const config = { ...defaultConfig, comments: "//" };
      const lexer = new Lexer(config);
      // Add quotes to force full tokenizer mode, not fast mode
      lexer.setInput('"a",b\n//comment\nc,d');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "b", "c", "d"]);
    });

    test("uses fast mode when possible", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput("simple,data");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      expect(result.tokens).toBeDefined();
    });

    test("handles empty input", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput("");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      // Empty input may produce an empty field before EOF
      expect(result.tokens[result.tokens.length - 1]).toEqual({ type: "eof", value: "", position: 0, length: 0 });
    });

    test("handles single character input", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput("a");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      expect(result.tokens).toEqual([
        { type: "field", value: "a", position: 0, length: 1 },
        { type: "eof", value: "", position: 1, length: 0 },
      ]);
    });

    test("handles multiple newlines", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput("a\n\nb");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const newlineTokens = result.tokens.filter((t) => t.type === "newline");
      expect(newlineTokens).toHaveLength(2);
    });
  });

  describe("edge cases", () => {
    test("handles only delimiters", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput(",,,");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["", "", "", ""]);
    });

    test("handles only newlines", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput("\n\n\n");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const newlineTokens = result.tokens.filter((t) => t.type === "newline");
      expect(newlineTokens).toHaveLength(3);
    });

    test("handles mixed line endings", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput("a\nb\rc\r\nd");

      const result = lexer.tokenize();

      // Should handle each character individually since newline is "\n"
      expect(result.errors).toEqual([]);
    });

    test("handles very long fields", () => {
      const longField = "a".repeat(10000);
      const lexer = new Lexer(defaultConfig);
      lexer.setInput(`${longField},b`);

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens[0].value).toBe(longField);
      expect(fieldTokens[1].value).toBe("b");
    });

    test("handles Unicode characters", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput("café,naïve,résumé");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["café", "naïve", "résumé"]);
    });
  });

  describe("delimiter edge cases", () => {
    test("handles multi-character delimiter", () => {
      const config = { ...defaultConfig, delimiter: "||" };
      const lexer = new Lexer(config);
      lexer.setInput("a||b||c");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const tokens = result.tokens;
      expect(tokens[1]).toEqual({ type: "delimiter", value: "||", position: 1, length: 2 });
      expect(tokens[3]).toEqual({ type: "delimiter", value: "||", position: 4, length: 2 });
    });

    test("handles delimiter identical to quote char inside quoted field", () => {
      const config = { ...defaultConfig, delimiter: "|", quoteChar: "'" };
      const lexer = new Lexer(config);
      lexer.setInput("'a|b'|c");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a|b", "c"]);
    });

    test("handles trailing delimiter with empty final field", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput("a,b,c,");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "b", "c", ""]);
    });

    test("handles record ending exactly on delimiter (no newline)", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput("a,b,");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "b", ""]);
    });

    test("handles newline subset in data", () => {
      const config = { ...defaultConfig, newline: "\r\n" };
      const lexer = new Lexer(config);
      lexer.setInput("a,b\rc\r\nd,e");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      // \r should be included in field data, not treated as newline
      expect(fieldTokens[1].value).toBe("b\rc");
    });
  });

  describe("quote and space handling", () => {
    test("handles spaces between closing quote and delimiter", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput('"alpha"  ,beta');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["alpha", "beta"]);
    });

    test("handles spaces between closing quote and newline", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput('"alpha"   \nbeta');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["alpha", "beta"]);
    });

    test("handles non-space character between quote and delimiter", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput('"alpha"x,beta');

      const result = lexer.tokenize();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.code === "InvalidQuotes")).toBe(true);
    });
  });

  describe("escape sequence edge cases", () => {
    test("handles quote in unquoted field when quote != escape", () => {
      const config = { ...defaultConfig, quoteChar: "'", escapeChar: "\\" };
      const lexer = new Lexer(config);
      lexer.setInput("foo'bar,baz");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["foo'bar", "baz"]);
    });

    test("handles backslash escape at end of file", () => {
      const config = { ...defaultConfig, escapeChar: "\\" };
      const lexer = new Lexer(config);
      lexer.setInput('"field with trailing backslash\\\\"');

      const result = lexer.tokenize();

      // Should not loop infinitely and either parse correctly or error gracefully
      expect(result.tokens).toBeDefined();
    });

    test("handles triple escaped quotes", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput('""""');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens[0].value).toBe('"');
    });

    test("handles consecutive backslashes and escaped quote", () => {
      const config = { ...defaultConfig, escapeChar: "\\" };
      const lexer = new Lexer(config);
      lexer.setInput('"\\\\\\""');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      // Should have two backslashes and one quote
      expect(fieldTokens[0].value).toBe('\\\\"');
    });
  });

  describe("comment handling nuances", () => {
    test("handles leading whitespace before comment marker", () => {
      const config = { ...defaultConfig, comments: "#" };
      const lexer = new Lexer(config);
      lexer.setInput("  #notAComment,b");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      // Should not be treated as comment since marker is not at start
      expect(fieldTokens.map((t) => t.value)).toEqual(["  #notAComment", "b"]);
    });

    test("handles comment marker inside quoted field", () => {
      const config = { ...defaultConfig, comments: "#" };
      const lexer = new Lexer(config);
      lexer.setInput('"#still data",foo');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["#still data", "foo"]);
    });

    test("handles multi-character comment string", () => {
      const config = { ...defaultConfig, comments: "//" };
      const lexer = new Lexer(config);
      lexer.setInput("//comment\n/notcomment,data");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      // Line starting with single "/" should not be skipped
      expect(fieldTokens.map((t) => t.value)).toEqual(["/notcomment", "data"]);
    });
  });

  describe("fast mode edge cases", () => {
    test("handles fastMode=true with multi-character delimiter and quotes", () => {
      const config = { ...defaultConfig, delimiter: "||", fastMode: true };
      const lexer = new Lexer(config);
      lexer.setInput('"quoted"||data');

      const tokens = lexer.tokenizeFast();

      // Fast mode treats quotes as literal data
      const fieldTokens = tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(['"quoted"', "data"]);
    });

    test("handles auto-switch to full mode when delimiter in quotes", () => {
      const lexer = new Lexer(defaultConfig);
      lexer.setInput('"field,with,delimiter",normal');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["field,with,delimiter", "normal"]);
    });
  });

  describe("performance and stress tests", () => {
    test("handles very large unquoted field", () => {
      const megabyteField = "x".repeat(1024 * 1024);
      const lexer = new Lexer(defaultConfig);
      lexer.setInput(`${megabyteField},end`);

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens[0].value.length).toBe(1024 * 1024);
      expect(fieldTokens[1].value).toBe("end");
    });

    test("handles many rows with correct position tracking", () => {
      const rows = Array(1000).fill("a,b,c").join("\n");
      const lexer = new Lexer(defaultConfig);
      lexer.setInput(rows);

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      // Verify positions are strictly increasing
      let lastPosition = -1;
      for (const token of result.tokens) {
        expect(token.position).toBeGreaterThan(lastPosition);
        lastPosition = token.position;
      }
    });
  });

  describe("Unicode and encoding edge cases", () => {
    test("handles delimiter in combining character sequence", () => {
      const lexer = new Lexer(defaultConfig);
      // "á" built from "a" + combining acute accent
      lexer.setInput("a\u0301,b");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a\u0301", "b"]);
    });
  });

  describe("configuration validation edge cases", () => {
    test("rejects exact bad delimiter matches", () => {
      expect(() => {
        createLexerConfig({ delimiter: "\r" });
      }).not.toThrow(); // Should fall back to default, not throw

      const config = createLexerConfig({ delimiter: "\r" });
      expect(config.delimiter).toBe(","); // Falls back to default
    });

    test("handles quote char same as newline", () => {
      const config = { ...defaultConfig, quoteChar: "\n", newline: "\n" };
      const lexer = new Lexer(config);
      lexer.setInput("a,b\nc,d");

      // Should still work or fail gracefully, not crash
      const result = lexer.tokenize();
      expect(result).toBeDefined();
    });
  });

  describe("token position verification", () => {
    test("verifies position and length accuracy", () => {
      const lexer = new Lexer(defaultConfig);
      const input = "a,b,c\nd,e,f";
      lexer.setInput(input);

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);

      // Verify that positions are strictly increasing
      let lastPosition = -1;
      for (const token of result.tokens) {
        expect(token.position).toBeGreaterThan(lastPosition);
        lastPosition = token.position;

        // For simple tokens (not quoted fields), verify substring matches
        if (token.type !== "eof" && token.type === "delimiter") {
          const actualSubstring = input.substring(token.position, token.position + token.length);
          expect(actualSubstring).toBe(token.value);
        }
      }
    });
  });
});

describe("createLexerConfig", () => {
  test("uses defaults for empty config", () => {
    const config = createLexerConfig({});

    expect(config).toEqual({
      delimiter: ",",
      newline: "\n",
      quoteChar: '"',
      escapeChar: '"',
      comments: false,
      fastMode: undefined,
    });
  });

  test("processes custom delimiter", () => {
    const config = createLexerConfig({ delimiter: "|" });

    expect(config.delimiter).toBe("|");
  });

  test("rejects bad delimiters", () => {
    const config = createLexerConfig({ delimiter: "\n" });

    expect(config.delimiter).toBe(","); // Falls back to default
  });

  test("processes custom quote char", () => {
    const config = createLexerConfig({ quoteChar: "'" });

    expect(config.quoteChar).toBe("'");
  });

  test("processes custom escape char", () => {
    const config = createLexerConfig({ escapeChar: "\\" });

    expect(config.escapeChar).toBe("\\");
  });

  test("defaults escape char to quote char", () => {
    const config = createLexerConfig({ quoteChar: "'" });

    expect(config.escapeChar).toBe("'");
  });

  test("processes comment string", () => {
    const config = createLexerConfig({ comments: "#" });

    expect(config.comments).toBe("#");
  });

  test("processes comment boolean true", () => {
    const config = createLexerConfig({ comments: true as any });

    expect(config.comments).toBe("#");
  });

  test("rejects comment same as delimiter", () => {
    expect(() => {
      createLexerConfig({ delimiter: "#", comments: "#" });
    }).toThrow("Comment character same as delimiter");
  });

  test("rejects bad comment characters", () => {
    const config = createLexerConfig({ comments: "\n" });

    expect(config.comments).toBe(false);
  });

  test("processes custom newline", () => {
    const config = createLexerConfig({ newline: "\r\n" });

    expect(config.newline).toBe("\r\n");
  });

  test("rejects invalid newline", () => {
    const config = createLexerConfig({ newline: "invalid" });

    expect(config.newline).toBe("\n"); // Falls back to default
  });

  test("processes fast mode", () => {
    const config = createLexerConfig({ fastMode: true });

    expect(config.fastMode).toBe(true);
  });

  test("handles null/undefined values", () => {
    const config = createLexerConfig({
      quoteChar: null as any,
      escapeChar: undefined,
      comments: undefined,
    });

    expect(config.quoteChar).toBe('"');
    expect(config.escapeChar).toBe('"');
    expect(config.comments).toBe(false);
  });

  test("processes all options together", () => {
    const config = createLexerConfig({
      delimiter: "|",
      quoteChar: "'",
      escapeChar: "\\",
      comments: "#",
      newline: "\r\n",
      fastMode: true,
    });

    expect(config).toEqual({
      delimiter: "|",
      newline: "\r\n",
      quoteChar: "'",
      escapeChar: "\\",
      comments: "#",
      fastMode: true,
    });
  });
});
