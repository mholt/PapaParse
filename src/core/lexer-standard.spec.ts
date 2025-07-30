/**
 * Unit tests for StandardLexer functionality
 * Tests full quote state machine and complex CSV scenarios
 */

import { describe, expect, mock, test } from "bun:test";
import { createLexerConfig, type LexerConfig } from "./lexer-config";
import { StandardLexer, TokenType } from "./lexer-standard";

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

describe("StandardLexer TokenType", () => {
  test("defines all token types", () => {
    expect(TokenType.FIELD).toBe("field");
    expect(TokenType.DELIMITER).toBe("delimiter");
    expect(TokenType.NEWLINE).toBe("newline");
    expect(TokenType.COMMENT).toBe("comment");
    expect(TokenType.EOF).toBe("eof");
  });
});

describe("StandardLexer", () => {
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

    const lexer = new StandardLexer(config);
    expect(lexer).toBeDefined();
  });

  test("setInput stores input string", () => {
    const lexer = new StandardLexer(defaultConfig);
    lexer.setInput("test,data");
    // Input is stored internally, we'll verify through tokenization
  });

  describe("canUseFastMode", () => {
    test("returns true when no quotes in input", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput("simple,data,no,quotes");

      expect(lexer.canUseFastMode()).toBe(true);
    });

    test("returns false when quotes present", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput('simple,"quoted",data');

      expect(lexer.canUseFastMode()).toBe(false);
    });

    test("returns true when fastMode explicitly enabled", () => {
      const config = { ...defaultConfig, fastMode: true };
      const lexer = new StandardLexer(config);
      lexer.setInput('data,"with",quotes');

      expect(lexer.canUseFastMode()).toBe(true);
    });

    test("returns false when fastMode explicitly disabled", () => {
      const config = { ...defaultConfig, fastMode: false };
      const lexer = new StandardLexer(config);
      lexer.setInput("simple,data");

      expect(lexer.canUseFastMode()).toBe(false);
    });
  });

  describe("tokenizeFast", () => {
    test("tokenizes simple CSV without quotes", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput("a,b,c\n1,2,3");

      const tokens = lexer.tokenizeFast();

      expect(tokens).toEqual([
        { type: "field", value: "a", position: 0, length: 1 },
        { type: "delimiter", value: ",", position: 1, length: 1 },
        { type: "field", value: "b", position: 2, length: 1 },
        { type: "delimiter", value: ",", position: 3, length: 1 },
        { type: "field", value: "c", position: 4, length: 1 },
        { type: "newline", value: "\n", position: 4, length: 1 },
        { type: "field", value: "1", position: 6, length: 1 },
        { type: "delimiter", value: ",", position: 7, length: 1 },
        { type: "field", value: "2", position: 8, length: 1 },
        { type: "delimiter", value: ",", position: 9, length: 1 },
        { type: "field", value: "3", position: 10, length: 1 },
        { type: "eof", value: "", position: 11, length: 0 },
      ]);
    });

    test("throws error when quotes detected in input", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput('simple,"quoted",data');

      expect(() => lexer.tokenizeFast()).toThrow("Fast mode not available - quotes detected in input");
    });
  });

  describe("tokenize - full mode", () => {
    test("handles quoted fields", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput('a,"quoted field",c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "quoted field", "c"]);
    });

    test("handles escaped quotes", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput('a,"field with ""quotes""",c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", 'field with "quotes"', "c"]);
    });

    test("handles backslash escaped quotes", () => {
      const config = { ...defaultConfig, escapeChar: "\\" };
      const lexer = new StandardLexer(config);
      lexer.setInput('a,"field with \\"quotes\\"",c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", 'field with "quotes"', "c"]);
    });

    test("handles unterminated quoted field", () => {
      const lexer = new StandardLexer(defaultConfig);
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
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput('a,"quoted"extra,c');

      const result = lexer.tokenize();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        type: "Quotes",
        code: "InvalidQuotes",
        message: "Trailing quote on quoted field is malformed",
      });
    });

    test("handles quotes at field boundaries", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput('"start","middle","end"');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["start", "middle", "end"]);
    });

    test("handles quoted fields with newlines", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput('a,"field\nwith\nnewlines",c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "field\nwith\nnewlines", "c"]);
    });

    test("handles quoted fields with delimiters", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput('a,"field,with,delimiters",c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "field,with,delimiters", "c"]);
    });

    test("handles empty quoted fields", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput('a,"",c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "", "c"]);
    });

    test("handles spaces around quotes", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput('a, "quoted" ,c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "quoted", "c"]);
    });

    test("handles quoted field at EOF", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput('a,"quoted"');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "quoted"]);
    });
  });

  describe("comment handling", () => {
    test("skips comment lines", () => {
      const config = { ...defaultConfig, comments: "#" };
      const lexer = new StandardLexer(config);
      lexer.setInput("a,b\n#comment\nc,d");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "b", "c", "d"]);
    });

    test("handles comment at EOF", () => {
      const config = { ...defaultConfig, comments: "#" };
      const lexer = new StandardLexer(config);
      lexer.setInput("a,b\n#comment");

      const result = lexer.tokenize();

      expect(result.terminatedByComment).toBe(true);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "b"]);
    });

    test("handles multi-character comment string", () => {
      const config = { ...defaultConfig, comments: "//" };
      const lexer = new StandardLexer(config);
      lexer.setInput("//comment\n/notcomment,data");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      // Line starting with single "/" should not be skipped
      expect(fieldTokens.map((t) => t.value)).toEqual(["/notcomment", "data"]);
    });

    test("handles comment with quoted fields", () => {
      const config = { ...defaultConfig, comments: "#" };
      const lexer = new StandardLexer(config);
      lexer.setInput('"quoted field",b\n#comment\nc,"another quoted"');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["quoted field", "b", "c", "another quoted"]);
    });
  });

  describe("auto-switching between fast and full mode", () => {
    test("uses fast mode when no quotes present", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput("simple,data,no,quotes");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["simple", "data", "no", "quotes"]);
    });

    test("uses full mode when quotes present", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput('"field,with,delimiter",normal');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["field,with,delimiter", "normal"]);
    });
  });

  describe("custom delimiters and newlines", () => {
    test("handles custom delimiters", () => {
      const config = { ...defaultConfig, delimiter: "|" };
      const lexer = new StandardLexer(config);
      lexer.setInput('a|"quoted|field"|c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "quoted|field", "c"]);
    });

    test("handles custom newlines", () => {
      const config = { ...defaultConfig, newline: "\r\n" };
      const lexer = new StandardLexer(config);
      lexer.setInput('a,"field\r\nwith\r\ncustom\r\nnewlines",c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "field\r\nwith\r\ncustom\r\nnewlines", "c"]);
    });

    test("handles multi-character delimiters", () => {
      const config = { ...defaultConfig, delimiter: "||" };
      const lexer = new StandardLexer(config);
      lexer.setInput('a||"quoted||field"||c');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "quoted||field", "c"]);
    });
  });

  describe("custom quote and escape characters", () => {
    test("handles single quote character", () => {
      const config = { ...defaultConfig, quoteChar: "'", escapeChar: "'" };
      const lexer = new StandardLexer(config);
      lexer.setInput("a,'quoted field',c");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "quoted field", "c"]);
    });

    test("handles escaped single quotes", () => {
      const config = { ...defaultConfig, quoteChar: "'", escapeChar: "'" };
      const lexer = new StandardLexer(config);
      lexer.setInput("a,'field with ''quotes''',c");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "field with 'quotes'", "c"]);
    });

    test("handles reserved regex characters as quote char", () => {
      const config = { ...defaultConfig, quoteChar: ".", escapeChar: "." };
      const lexer = new StandardLexer(config);
      lexer.setInput("a,.quoted field.,c");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a", "quoted field", "c"]);
    });
  });

  describe("performance and stress tests", () => {
    test("handles very large quoted field", () => {
      const megabyteField = "x".repeat(1024 * 1024);
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput(`"${megabyteField}",end`);

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens[0].value.length).toBe(1024 * 1024);
      expect(fieldTokens[1].value).toBe("end");
    });

    test("handles many rows with quotes", () => {
      const rows = Array(1000).fill('"a","b","c"').join("\n");
      const lexer = new StandardLexer(defaultConfig);
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

    test("handles deeply nested quotes", () => {
      const nestedQuotes = '"'.repeat(100);
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput(`"${nestedQuotes}"`);

      const result = lexer.tokenize();

      // Should handle without crashing
      expect(result).toBeDefined();
    });
  });

  describe("Unicode and encoding edge cases", () => {
    test("handles Unicode in quoted fields", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput('"café","naïve","résumé"');

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["café", "naïve", "résumé"]);
    });

    test("handles delimiter in combining character sequence", () => {
      const lexer = new StandardLexer(defaultConfig);
      // "á" built from "a" + combining acute accent
      lexer.setInput("a\u0301,b");

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["a\u0301", "b"]);
    });
  });

  describe("edge cases and error scenarios", () => {
    test("handles quote char same as delimiter", () => {
      const config = { ...defaultConfig, quoteChar: ",", delimiter: "," };
      const lexer = new StandardLexer(config);
      lexer.setInput("a,b,c");

      // Should work or fail gracefully, not crash
      const result = lexer.tokenize();
      expect(result).toBeDefined();
    });

    test("handles quote char same as newline", () => {
      const config = { ...defaultConfig, quoteChar: "\n", newline: "\n" };
      const lexer = new StandardLexer(config);
      lexer.setInput("a,b\nc,d");

      // Should work or fail gracefully, not crash
      const result = lexer.tokenize();
      expect(result).toBeDefined();
    });

    test("handles empty input", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput("");

      const result = lexer.tokenize();

      // Should produce only EOF token
      expect(result.tokens).toEqual([{ type: "eof", value: "", position: 0, length: 0 }]);
    });

    test("handles only quotes", () => {
      const lexer = new StandardLexer(defaultConfig);
      lexer.setInput('""""');

      const result = lexer.tokenize();

      // Should handle escaped quotes correctly
      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens[0].value).toBe('"');
    });
  });

  describe("token position verification", () => {
    test("verifies position and length accuracy", () => {
      const lexer = new StandardLexer(defaultConfig);
      const input = 'a,"quoted field",c\nd,e,f';
      lexer.setInput(input);

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);

      // Verify that positions are strictly increasing
      let lastPosition = -1;
      for (const token of result.tokens) {
        expect(token.position).toBeGreaterThan(lastPosition);
        lastPosition = token.position;

        // For delimiter and newline tokens, verify substring matches
        if (token.type === "delimiter" || token.type === "newline") {
          const actualSubstring = input.substring(token.position, token.position + token.length);
          expect(actualSubstring).toBe(token.value);
        }
      }
    });

    test("handles complex position tracking with quotes", () => {
      const lexer = new StandardLexer(defaultConfig);
      const input = 'start,"middle with ""quotes""",end';
      lexer.setInput(input);

      const result = lexer.tokenize();

      expect(result.errors).toEqual([]);
      const fieldTokens = result.tokens.filter((t) => t.type === "field");
      expect(fieldTokens.map((t) => t.value)).toEqual(["start", 'middle with "quotes"', "end"]);
    });
  });
});
