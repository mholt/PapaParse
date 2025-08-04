import { describe, it } from "bun:test";
import { runParseTest, type TestCase } from "./test-utils.js";

describe("Core Parser Tests", () => {
  it("should parse one row", () => {
    runParseTest({
      description: "One row",
      input: "A,b,c",
      expected: {
        data: [["A", "b", "c"]],
        errors: [],
        meta: { delimiter: ",", renamedHeaders: null },
      },
    });
  });

  it("should parse two rows", () => {
    runParseTest({
      description: "Two rows",
      input: "A,b,c\nd,E,f",
      expected: {
        data: [
          ["A", "b", "c"],
          ["d", "E", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should parse three rows", () => {
    runParseTest({
      description: "Three rows",
      input: "A,b,c\nd,E,f\nG,h,i",
      expected: {
        data: [
          ["A", "b", "c"],
          ["d", "E", "f"],
          ["G", "h", "i"],
        ],
        errors: [],
      },
    });
  });

  it("should preserve whitespace at edges of unquoted field", () => {
    runParseTest({
      description: "Whitespace at edges of unquoted field",
      input: "a,\tb ,c",
      expected: {
        data: [["a", "\tb ", "c"]],
        errors: [],
      },
    });
  });

  it("should parse quoted field", () => {
    runParseTest({
      description: "Quoted field",
      input: 'A,"B",C',
      expected: {
        data: [["A", "B", "C"]],
        errors: [],
      },
    });
  });

  it("should parse quoted field with extra whitespace on edges", () => {
    runParseTest({
      description: "Quoted field with extra whitespace on edges",
      input: 'A," B  ",C',
      expected: {
        data: [["A", " B  ", "C"]],
        errors: [],
      },
    });
  });

  it("should parse quoted field with delimiter", () => {
    runParseTest({
      description: "Quoted field with delimiter",
      input: 'A,"B,B",C',
      expected: {
        data: [["A", "B,B", "C"]],
        errors: [],
      },
    });
  });

  it("should parse quoted field with line break", () => {
    runParseTest({
      description: "Quoted field with line break",
      input: 'A,"B\nB",C',
      expected: {
        data: [["A", "B\nB", "C"]],
        errors: [],
      },
    });
  });

  it("should parse quoted fields with line breaks", () => {
    runParseTest({
      description: "Quoted fields with line breaks",
      input: 'A,"B\nB","C\nC\nC"',
      expected: {
        data: [["A", "B\nB", "C\nC\nC"]],
        errors: [],
      },
    });
  });

  it("should parse quoted fields at end of row with delimiter and line break", () => {
    runParseTest({
      description: "Quoted fields at end of row with delimiter and line break",
      input: 'a,b,"c,c\nc"\nd,e,f',
      expected: {
        data: [
          ["a", "b", "c,c\nc"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should parse quoted field with escaped quotes", () => {
    runParseTest({
      description: "Quoted field with escaped quotes",
      input: 'A,"B""B""B",C',
      expected: {
        data: [["A", 'B"B"B', "C"]],
        errors: [],
      },
    });
  });

  it("should parse quoted field with escaped quotes at boundaries", () => {
    runParseTest({
      description: "Quoted field with escaped quotes at boundaries",
      input: 'A,"""B""",C',
      expected: {
        data: [["A", '"B"', "C"]],
        errors: [],
      },
    });
  });

  it("should handle unquoted field with quotes at end", () => {
    runParseTest({
      description: "Unquoted field with quotes at end of field",
      input: 'A,B",C',
      expected: {
        data: [["A", 'B"', "C"]],
        errors: [],
      },
    });
  });

  it("should parse quoted field with quotes around delimiter", () => {
    runParseTest({
      description: "Quoted field with quotes around delimiter",
      input: 'A,""",""",C',
      expected: {
        data: [["A", '","', "C"]],
        errors: [],
      },
    });
  });

  it("should parse quoted field with quotes on right side of delimiter", () => {
    runParseTest({
      description: "Quoted field with quotes on right side of delimiter",
      input: 'A,",""",C',
      expected: {
        data: [["A", ',"', "C"]],
        errors: [],
      },
    });
  });

  it("should parse quoted field with quotes on left side of delimiter", () => {
    runParseTest({
      description: "Quoted field with quotes on left side of delimiter",
      input: 'A,""",",C',
      expected: {
        data: [["A", '",', "C"]],
        errors: [],
      },
    });
  });

  it("should parse quoted field with 5 quotes in a row and a delimiter", () => {
    runParseTest({
      description: "Quoted field with 5 quotes in a row and a delimiter in there, too",
      input: '"1","cnonce="""",nc=""""","2"',
      expected: {
        data: [["1", 'cnonce="",nc=""', "2"]],
        errors: [],
      },
    });
  });

  it("should handle quoted field with whitespace around quotes", () => {
    runParseTest({
      description: "Quoted field with whitespace around quotes",
      input: 'A, "B" ,C',
      expected: {
        data: [["A", ' "B" ', "C"]],
        errors: [],
      },
    });
  });

  it("should handle misplaced quotes in data", () => {
    runParseTest({
      description: "Misplaced quotes in data, not as opening quotes",
      input: 'A,B "B",C',
      expected: {
        data: [["A", 'B "B"', "C"]],
        errors: [],
      },
    });
  });

  it("should handle quoted field with no closing quote", () => {
    runParseTest({
      description: "Quoted field has no closing quote",
      input: 'a,"b,c\nd,e,f',
      expected: {
        data: [["a", "b,c\nd,e,f"]],
        errors: [
          {
            type: "Quotes",
            code: "MissingQuotes",
            message: "Quoted field unterminated",
            row: 0,
            index: 3,
          },
        ],
      },
    });
  });

  it("should handle quoted field with invalid trailing quote after delimiter with valid closer", () => {
    runParseTest({
      description: "Quoted field has invalid trailing quote after delimiter with a valid closer",
      input: '"a,"b,c"\nd,e,f',
      expected: {
        data: [['a,"b,c'], ["d", "e", "f"]],
        errors: [
          {
            type: "Quotes",
            code: "InvalidQuotes",
            message: "Trailing quote on quoted field is malformed",
            row: 0,
            index: 1,
          },
        ],
      },
    });
  });

  it("should handle quoted field with invalid trailing quote after delimiter", () => {
    runParseTest({
      description: "Quoted field has invalid trailing quote after delimiter",
      input: 'a,"b,"c\nd,e,f',
      expected: {
        data: [["a", 'b,"c\nd,e,f']],
        errors: [
          {
            type: "Quotes",
            code: "InvalidQuotes",
            message: "Trailing quote on quoted field is malformed",
            row: 0,
            index: 3,
          },
          {
            type: "Quotes",
            code: "MissingQuotes",
            message: "Quoted field unterminated",
            row: 0,
            index: 3,
          },
        ],
      },
    });
  });

  it("should handle quoted field with invalid trailing quote before delimiter", () => {
    runParseTest({
      description: "Quoted field has invalid trailing quote before delimiter",
      input: 'a,"b"c,d\ne,f,g',
      expected: {
        data: [["a", 'b"c,d\ne,f,g']],
        errors: [
          {
            type: "Quotes",
            code: "InvalidQuotes",
            message: "Trailing quote on quoted field is malformed",
            row: 0,
            index: 3,
          },
          {
            type: "Quotes",
            code: "MissingQuotes",
            message: "Quoted field unterminated",
            row: 0,
            index: 3,
          },
        ],
      },
    });
  });

  it("should handle quoted field with invalid trailing quote after new line", () => {
    runParseTest({
      description: "Quoted field has invalid trailing quote after new line",
      input: 'a,"b,c\nd"e,f,g',
      expected: {
        data: [["a", 'b,c\nd"e,f,g']],
        errors: [
          {
            type: "Quotes",
            code: "InvalidQuotes",
            message: "Trailing quote on quoted field is malformed",
            row: 0,
            index: 3,
          },
          {
            type: "Quotes",
            code: "MissingQuotes",
            message: "Quoted field unterminated",
            row: 0,
            index: 3,
          },
        ],
      },
    });
  });

  it("should handle quoted field with valid trailing quote via delimiter", () => {
    runParseTest({
      description: "Quoted field has valid trailing quote via delimiter",
      input: 'a,"b",c\nd,e,f',
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should handle quoted field with valid trailing quote via newline", () => {
    runParseTest({
      description: "Quoted field has valid trailing quote via \\n",
      input: 'a,b,"c"\nd,e,f',
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should handle quoted field with valid trailing quote via EOF", () => {
    runParseTest({
      description: "Quoted field has valid trailing quote via EOF",
      input: 'a,b,c\nd,e,"f"',
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should handle quoted field containing delimiters and newlines with valid trailing quote", () => {
    runParseTest({
      description: "Quoted field contains delimiters and \\n with valid trailing quote",
      input: 'a,"b,c\nd,e,f"',
      expected: {
        data: [["a", "b,c\nd,e,f"]],
        errors: [],
      },
    });
  });

  it("should handle line starting with quoted field", () => {
    runParseTest({
      description: "Line starts with quoted field",
      input: 'a,b,c\n"d",e,f',
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should handle line starting with unquoted empty field", () => {
    runParseTest({
      description: "Line starts with unquoted empty field",
      input: ',b,c\n"d",e,f',
      expected: {
        data: [
          ["", "b", "c"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should handle line ending with quoted field", () => {
    runParseTest({
      description: "Line ends with quoted field",
      input: 'a,b,c\nd,e,f\n"g","h","i"\n"j","k","l"',
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
          ["g", "h", "i"],
          ["j", "k", "l"],
        ],
        errors: [],
      },
    });
  });

  it("should handle line ending with quoted field, first field of next line is empty", () => {
    runParseTest({
      description: "Line ends with quoted field, first field of next line is empty, \\n",
      input: 'a,b,c\n,e,f\n,"h","i"\n,"k","l"',
      config: { newline: "\n" },
      expected: {
        data: [
          ["a", "b", "c"],
          ["", "e", "f"],
          ["", "h", "i"],
          ["", "k", "l"],
        ],
        errors: [],
      },
    });
  });

  it("should handle quoted field at end of row with quotes", () => {
    runParseTest({
      description: "Quoted field at end of row (but not at EOF) has quotes",
      input: 'a,b,"c""c"""\nd,e,f',
      expected: {
        data: [
          ["a", "b", 'c"c"'],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should handle empty quoted field at EOF", () => {
    runParseTest({
      description: "Empty quoted field at EOF is empty",
      input: 'a,b,""\na,b,""',
      expected: {
        data: [
          ["a", "b", ""],
          ["a", "b", ""],
        ],
        errors: [],
      },
    });
  });

  it("should handle multiple consecutive empty fields", () => {
    runParseTest({
      description: "Multiple consecutive empty fields",
      input: "a,b,,,c,d\n,,e,,,f",
      expected: {
        data: [
          ["a", "b", "", "", "c", "d"],
          ["", "", "e", "", "", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should handle empty input string", () => {
    runParseTest({
      description: "Empty input string",
      input: "",
      expected: {
        data: [],
        errors: [
          {
            type: "Delimiter",
            code: "UndetectableDelimiter",
            message: "Unable to auto-detect delimiting character; defaulted to ','",
          },
        ],
      },
    });
  });

  it("should handle input with just delimiter", () => {
    runParseTest({
      description: "Input is just the delimiter (2 empty fields)",
      input: ",",
      expected: {
        data: [["", ""]],
        errors: [],
      },
    });
  });

  it("should handle input with just empty fields", () => {
    runParseTest({
      description: "Input is just empty fields",
      input: ",,\n,,,",
      expected: {
        data: [
          ["", "", ""],
          ["", "", "", ""],
        ],
        errors: [],
      },
    });
  });

  it("should handle input that is just a string", () => {
    runParseTest({
      description: "Input is just a string (a single field)",
      input: "Abc def",
      expected: {
        data: [["Abc def"]],
        errors: [
          {
            type: "Delimiter",
            code: "UndetectableDelimiter",
            message: "Unable to auto-detect delimiting character; defaulted to ','",
          },
        ],
      },
    });
  });
});
