/**
 * Unit tests for FastLexer functionality
 * Tests optimized tokenization for inputs without quotes
 */

import { describe, expect, mock, test } from "bun:test";
import { createLexerConfig, type LexerConfig } from "./lexer-config";
import { FastLexer, TokenType } from "./lexer-fast";

// Mock dependencies
mock.module("../constants/index.js", () => ({
  CONSTANTS: {
    DefaultDelimiter: ",",
    BAD_DELIMITERS: ["\r", "\n", '"', "\b", "\t", "\\"],
  },
}));

describe("FastLexer TokenType", () => {
  test("defines all token types", () => {
    expect(TokenType.FIELD).toBe("field");
    expect(TokenType.DELIMITER).toBe("delimiter");
    expect(TokenType.NEWLINE).toBe("newline");
    expect(TokenType.COMMENT).toBe("comment");
    expect(TokenType.EOF).toBe("eof");
  });
});

describe("FastLexer", () => {
  const defaultConfig: LexerConfig = {
    delimiter: ",",
    newline: "\n",
    quoteChar: '"',
    escapeChar: '"',
    comments: false,
    fastMode: undefined,
  };

  const createFastLexer = (config: Partial<LexerConfig> = {}) => {
    const lexerConfig = { ...defaultConfig, ...config };
    const papaConfig = {
      delimiter: lexerConfig.delimiter,
      newline: lexerConfig.newline,
      quoteChar: lexerConfig.quoteChar,
      escapeChar: lexerConfig.escapeChar,
      comments: lexerConfig.comments,
      fastMode: lexerConfig.fastMode,
    };
    return new FastLexer(papaConfig, lexerConfig);
  };

  test("constructor initializes with config", () => {
    const lexerConfig: LexerConfig = {
      delimiter: "|",
      newline: "\r\n",
      quoteChar: "'",
      escapeChar: "\\",
      comments: "#",
      fastMode: true,
    };
    const papaConfig = {
      delimiter: "|",
      newline: "\r\n",
      quoteChar: "'",
      escapeChar: "\\",
      comments: "#",
      fastMode: true,
    };

    const lexer = new FastLexer(papaConfig, lexerConfig);
    expect(lexer).toBeDefined();
  });

  test("setInput stores input string", () => {
    const lexer = createFastLexer();
    lexer.setInput("test,data");
    // Input is stored internally, we'll verify through tokenization
  });

  describe("tokenize", () => {
    test("tokenizes simple CSV without quotes", () => {
      const lexer = createFastLexer();
      lexer.setInput("a,b,c\n1,2,3");

      const result = lexer.tokenize();

      expect(result.tokens).toEqual([
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

    test("handles quotes as literal characters", () => {
      const lexer = createFastLexer();
      lexer.setInput('simple,"quoted",data');

      const result = lexer.tokenize();

      // FastLexer treats quotes as literal characters
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["simple", '"quoted"', "data"]);
    });

    test("handles empty fields", () => {
      const lexer = createFastLexer();
      lexer.setInput("a,,c");

      const result = lexer.tokenize();

      expect(result.tokens[0]).toEqual({ type: "field", value: "a", position: 0, length: 1 });
      expect(result.tokens[1]).toEqual({ type: "delimiter", value: ",", position: 1, length: 1 });
      expect(result.tokens[2]).toEqual({ type: "field", value: "", position: 2, length: 0 });
      expect(result.tokens[3]).toEqual({ type: "delimiter", value: ",", position: 2, length: 1 });
      expect(result.tokens[4]).toEqual({ type: "field", value: "c", position: 3, length: 1 });
    });

    test("skips comment lines", () => {
      const lexer = createFastLexer({ comments: "#" });
      lexer.setInput("a,b\n#comment\nc,d");

      const result = lexer.tokenize();

      // Should skip the comment line entirely
      const fieldValues = result.tokens.filter((t) => t.type === "field").map((t) => t.value);
      expect(fieldValues).toEqual(["a", "b", "c", "d"]);
    });

    test("handles custom delimiters", () => {
      const lexer = createFastLexer({ delimiter: "|" });
      lexer.setInput("a|b|c");

      const result = lexer.tokenize();

      expect(result.tokens[1]).toEqual({ type: "delimiter", value: "|", position: 1, length: 1 });
      expect(result.tokens[3]).toEqual({ type: "delimiter", value: "|", position: 3, length: 1 });
    });

    test("handles custom newlines", () => {
      const lexer = createFastLexer({ newline: "\r\n" });
      lexer.setInput("a,b\r\nc,d");

      const result = lexer.tokenize();

      // Find the newline token
      const newlineToken = result.tokens.find((t) => t.type === "newline");
      expect(newlineToken).toEqual({ type: "newline", value: "\r\n", position: 3, length: 2 });
    });

    test("handles empty input", () => {
      const lexer = createFastLexer();
      lexer.setInput("");

      const result = lexer.tokenize();

      // Empty input produces single empty field and EOF
      expect(result.tokens).toEqual([
        { type: "field", value: "", position: 0, length: 0 },
        { type: "eof", value: "", position: 0, length: 0 },
      ]);
    });

    test("handles single field", () => {
      const lexer = createFastLexer();
      lexer.setInput("single");

      const result = lexer.tokenize();

      expect(result.tokens).toEqual([
        { type: "field", value: "single", position: 0, length: 6 },
        { type: "eof", value: "", position: 6, length: 0 },
      ]);
    });

    test("handles multi-character delimiters", () => {
      const lexer = createFastLexer({ delimiter: "||" });
      lexer.setInput("a||b||c");

      const result = lexer.tokenize();

      expect(result.tokens[1]).toEqual({ type: "delimiter", value: "||", position: 1, length: 2 });
      expect(result.tokens[3]).toEqual({ type: "delimiter", value: "||", position: 4, length: 2 });
    });

    test("handles trailing newline", () => {
      const lexer = createFastLexer();
      lexer.setInput("a,b\n");

      const result = lexer.tokenize();

      const newlineToken = result.tokens.find((t) => t.type === "newline");
      expect(newlineToken).toBeDefined();
      expect(result.tokens[result.tokens.length - 1].type).toBe("eof");
    });

    test("handles multiple comment lines", () => {
      const lexer = createFastLexer({ comments: "#" });
      lexer.setInput("#comment1\n#comment2\na,b\n#comment3\nc,d");

      const result = lexer.tokenize();

      const fieldValues = result.tokens.filter((t) => t.type === "field").map((t) => t.value);
      expect(fieldValues).toEqual(["a", "b", "c", "d"]);
    });

    test("handles only comment lines", () => {
      const lexer = createFastLexer({ comments: "#" });
      lexer.setInput("#comment1\n#comment2");

      const result = lexer.tokenize();

      // Should only have EOF token
      expect(result.tokens).toEqual([{ type: "eof", value: "", position: 19, length: 0 }]);
    });
  });

  describe("performance and stress tests", () => {
    test("handles very large unquoted field efficiently", () => {
      const largeField = "x".repeat(100000);
      const lexer = createFastLexer();
      lexer.setInput(`${largeField},end`);

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens[0].value.length).toBe(100000);
      expect(fieldTokens[1].value).toBe("end");
    });

    test("handles many rows with correct position tracking", () => {
      const rows = Array(1000).fill("a,b,c").join("\n");
      const lexer = createFastLexer();
      lexer.setInput(rows);

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      // Verify positions are strictly increasing
      let lastPosition = -1;
      for (const token of result.tokens) {
        expect(token.position).toBeGreaterThanOrEqual(lastPosition);
        lastPosition = token.position;
      }
    });

    test("handles large single row", () => {
      const fields = Array(1000).fill("field").join(",");
      const lexer = createFastLexer();
      lexer.setInput(fields);

      const result = lexer.tokenize();

      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens).toHaveLength(1000);
      expect(fieldTokens.every((t) => t.value === "field")).toBe(true);
    });
  });

  describe("fastMode with quotes enabled", () => {
    test("treats quotes as literal when fastMode=true", () => {
      const lexer = createFastLexer({ fastMode: true });
      lexer.setInput('"quoted",field');

      const result = lexer.tokenize();

      // Fast mode treats quotes as literal data
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(['"quoted"', "field"]);
    });

    test("handles fastMode=true with multi-character delimiter and quotes", () => {
      const lexer = createFastLexer({ delimiter: "||", fastMode: true });
      lexer.setInput('"quoted"||data');

      const result = lexer.tokenize();

      // Fast mode treats quotes as literal data
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(['"quoted"', "data"]);
    });
  });

  describe("Unicode and encoding support", () => {
    test("handles Unicode characters", () => {
      const lexer = createFastLexer();
      lexer.setInput("café,naïve,résumé");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["café", "naïve", "résumé"]);
    });

    test("handles combining character sequences", () => {
      const lexer = createFastLexer();
      // "á" built from "a" + combining acute accent
      lexer.setInput("a\u0301,b");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a\u0301", "b"]);
    });
  });

  describe("edge cases", () => {
    test("handles only delimiters", () => {
      const lexer = createFastLexer();
      lexer.setInput(",,");

      const result = lexer.tokenize();

      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["", "", ""]);
    });

    test("handles only newlines", () => {
      const lexer = createFastLexer();
      lexer.setInput("\n\n");

      const result = lexer.tokenize();

      // Should create empty fields for each row
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["", "", ""]);
    });

    test("handles mixed whitespace", () => {
      const lexer = createFastLexer();
      lexer.setInput(" a , b , c ");

      const result = lexer.tokenize();

      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual([" a ", " b ", " c "]);
    });
  });
});
