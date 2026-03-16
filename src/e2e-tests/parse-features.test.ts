import { describe, it } from "bun:test";
import { runParseTest, type TestCase } from "./test-utils.js";

describe("Parse Features Tests", () => {
  it("should handle comments at beginning", () => {
    runParseTest({
      description: "Commented line at beginning",
      input: "# Comment!\na,b,c",
      config: { comments: true },
      expected: {
        data: [["a", "b", "c"]],
        errors: [],
      },
    });
  });

  it("should handle comments in middle", () => {
    runParseTest({
      description: "Commented line in middle",
      input: "a,b,c\n# Comment\nd,e,f",
      config: { comments: true },
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should handle comments at end", () => {
    runParseTest({
      description: "Commented line at end",
      input: "a,true,false\n# Comment",
      config: { comments: true },
      expected: {
        data: [["a", "true", "false"]],
        errors: [],
      },
    });
  });

  it("should handle two consecutive comment lines", () => {
    runParseTest({
      description: "Two comment lines consecutively",
      input: "a,b,c\n#comment1\n#comment2\nd,e,f",
      config: { comments: true },
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should handle two consecutive comment lines at end of file", () => {
    runParseTest({
      description: "Two comment lines consecutively at end of file",
      input: "a,b,c\n#comment1\n#comment2",
      config: { comments: true },
      expected: {
        data: [["a", "b", "c"]],
        errors: [],
      },
    });
  });

  it("should handle three consecutive comment lines at beginning", () => {
    runParseTest({
      description: "Three comment lines consecutively at beginning of file",
      input: "#comment1\n#comment2\n#comment3\na,b,c",
      config: { comments: true },
      expected: {
        data: [["a", "b", "c"]],
        errors: [],
      },
    });
  });

  it("should handle entire file as comments", () => {
    runParseTest({
      description: "Entire file is comment lines",
      input: "#comment1\n#comment2\n#comment3",
      config: { comments: true },
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

  it("should handle custom comment character", () => {
    runParseTest({
      description: "Comment with non-default character",
      input: "a,b,c\n!Comment goes here\nd,e,f",
      config: { comments: "!" },
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should handle bad comments value", () => {
    runParseTest({
      description: "Bad comments value specified",
      input: "a,b,c\n5comment\nd,e,f",
      config: { comments: 5 as any },
      expected: {
        data: [["a", "b", "c"], ["5comment"], ["d", "e", "f"]],
        errors: [],
      },
    });
  });

  it("should handle multi-character comment string", () => {
    runParseTest({
      description: "Multi-character comment string",
      input: "a,b,c\n=N(Comment)\nd,e,f",
      config: { comments: "=N(" },
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should apply dynamic typing to numbers", () => {
    runParseTest({
      description: "Dynamic typing converts to numbers",
      input: "1,2.2,1e3\r\n-4,-4.5,-4e-5\r\n-,5a,5-2",
      config: { dynamicTyping: true },
      expected: {
        data: [
          [1, 2.2, 1000],
          [-4, -4.5, -0.00004],
          ["-", "5a", "5-2"],
        ],
        errors: [],
      },
    });
  });

  it("should apply dynamic typing to booleans", () => {
    runParseTest({
      description: "Dynamic typing converts to booleans",
      input: "true,false,T,F,TRUE,FALSE,True,False",
      config: { dynamicTyping: true },
      expected: {
        data: [[true, false, "T", "F", true, false, "True", "False"]],
        errors: [],
      },
    });
  });

  it("should apply dynamic typing with header", () => {
    runParseTest({
      description: "Dynamic typing with header",
      input: "A,B,C\r\n1,2.2,1e3\r\n-4,-4.5,-4e-5",
      config: { header: true, dynamicTyping: true },
      expected: {
        data: [
          { A: 1, B: 2.2, C: 1000 },
          { A: -4, B: -4.5, C: -0.00004 },
        ],
        errors: [],
      },
    });
  });

  it("should apply dynamic typing with specific column names", () => {
    runParseTest({
      description: "Dynamic typing with specific column names",
      input: "A_as_int,B,C_as_int\r\n1,002,3",
      config: {
        header: true,
        dynamicTyping: { A_as_int: true, C_as_int: true },
      },
      expected: {
        data: [{ A_as_int: 1, B: "002", C_as_int: 3 }],
        errors: [],
      },
    });
  });

  it("should convert empty values to null with dynamic typing", () => {
    runParseTest({
      description: "Dynamic typing converts empty values into NULL",
      input: "1,2.2,1e3\r\n,NULL,\r\n-,5a,null",
      config: { dynamicTyping: true },
      expected: {
        data: [
          [1, 2.2, 1000],
          [null, "NULL", null],
          ["-", "5a", "null"],
        ],
        errors: [],
      },
    });
  });

  it("should apply custom transform function", () => {
    runParseTest({
      description: "Custom transform function is applied to values",
      input: "A,B,C\r\nd,e,f",
      config: {
        transform: (value: string) => value.toLowerCase(),
      },
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should apply transform with column number", () => {
    runParseTest({
      description: "Custom transform accepts column number also",
      input: "A,B,C\r\nd,e,f",
      config: {
        transform: (value: string, column: number) => {
          if (column % 2) {
            value = value.toLowerCase();
          }
          return value;
        },
      },
      expected: {
        data: [
          ["A", "b", "C"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should apply transform with header name", () => {
    runParseTest({
      description: "Custom transform accepts header name when using header",
      input: "A,B,C\r\nd,e,f",
      config: {
        header: true,
        transform: (value: string, name: string) => {
          if (name === "B") {
            value = value.toUpperCase();
          }
          return value;
        },
      },
      expected: {
        data: [{ A: "d", B: "E", C: "f" }],
        errors: [],
      },
    });
  });

  it("should convert ISO date strings to Dates with dynamic typing", () => {
    runParseTest({
      description: "Dynamic typing converts ISO date strings to Dates",
      input:
        "ISO date,long date\r\n2018-05-04T21:08:03.269Z,Fri May 04 2018 14:08:03 GMT-0700 (PDT)\r\n2018-05-08T15:20:22.642Z,Tue May 08 2018 08:20:22 GMT-0700 (PDT)",
      config: { dynamicTyping: true },
      expected: {
        data: [
          ["ISO date", "long date"],
          [new Date("2018-05-04T21:08:03.269Z"), "Fri May 04 2018 14:08:03 GMT-0700 (PDT)"],
          [new Date("2018-05-08T15:20:22.642Z"), "Tue May 08 2018 08:20:22 GMT-0700 (PDT)"],
        ],
        errors: [],
      },
    });
  });

  it("should skip ISO date strings occurring in other strings", () => {
    runParseTest({
      description: "Dynamic typing skips ISO date strings occurring in other strings",
      input:
        "ISO date,String with ISO date\r\n2018-05-04T21:08:03.269Z,The date is 2018-05-04T21:08:03.269Z\r\n2018-05-08T15:20:22.642Z,The date is 2018-05-08T15:20:22.642Z",
      config: { dynamicTyping: true },
      expected: {
        data: [
          ["ISO date", "String with ISO date"],
          [new Date("2018-05-04T21:08:03.269Z"), "The date is 2018-05-04T21:08:03.269Z"],
          [new Date("2018-05-08T15:20:22.642Z"), "The date is 2018-05-08T15:20:22.642Z"],
        ],
        errors: [],
      },
    });
  });

  it("should handle blank line at beginning", () => {
    runParseTest({
      description: "Blank line at beginning",
      input: "\r\na,b,c\r\nd,e,f",
      config: { newline: "\r\n" },
      expected: {
        data: [[""], ["a", "b", "c"], ["d", "e", "f"]],
        errors: [],
      },
    });
  });

  it("should handle blank line in middle", () => {
    runParseTest({
      description: "Blank line in middle",
      input: "a,b,c\r\n\r\nd,e,f",
      config: { newline: "\r\n" },
      expected: {
        data: [["a", "b", "c"], [""], ["d", "e", "f"]],
        errors: [],
      },
    });
  });

  it("should handle blank lines at end", () => {
    runParseTest({
      description: "Blank lines at end",
      input: "a,b,c\nd,e,f\n\n",
      expected: {
        data: [["a", "b", "c"], ["d", "e", "f"], [""], [""]],
        errors: [],
      },
    });
  });

  it("should handle blank line in middle with whitespace", () => {
    runParseTest({
      description: "Blank line in middle with whitespace",
      input: "a,b,c\r\n \r\nd,e,f",
      expected: {
        data: [["a", "b", "c"], [" "], ["d", "e", "f"]],
        errors: [],
      },
    });
  });

  it("should handle first field of line being empty", () => {
    runParseTest({
      description: "First field of a line is empty",
      input: "a,b,c\r\n,e,f",
      expected: {
        data: [
          ["a", "b", "c"],
          ["", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should handle last field of line being empty", () => {
    runParseTest({
      description: "Last field of a line is empty",
      input: "a,b,\r\nd,e,f",
      expected: {
        data: [
          ["a", "b", ""],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should handle other fields being empty", () => {
    runParseTest({
      description: "Other fields are empty",
      input: "a,,c\r\n,,",
      expected: {
        data: [
          ["a", "", "c"],
          ["", "", ""],
        ],
        errors: [],
      },
    });
  });

  it("should handle preview with 0 rows", () => {
    runParseTest({
      description: "Preview 0 rows should default to parsing all",
      input: "a,b,c\r\nd,e,f\r\ng,h,i",
      config: { preview: 0 },
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
          ["g", "h", "i"],
        ],
        errors: [],
      },
    });
  });

  it("should handle preview with 1 row", () => {
    runParseTest({
      description: "Preview 1 row",
      input: "a,b,c\r\nd,e,f\r\ng,h,i",
      config: { preview: 1 },
      expected: {
        data: [["a", "b", "c"]],
        errors: [],
      },
    });
  });

  it("should handle preview with 2 rows", () => {
    runParseTest({
      description: "Preview 2 rows",
      input: "a,b,c\r\nd,e,f\r\ng,h,i",
      config: { preview: 2 },
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should handle preview with all rows", () => {
    runParseTest({
      description: "Preview all (3) rows",
      input: "a,b,c\r\nd,e,f\r\ng,h,i",
      config: { preview: 3 },
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
          ["g", "h", "i"],
        ],
        errors: [],
      },
    });
  });

  it("should handle preview with more rows than input has", () => {
    runParseTest({
      description: "Preview more rows than input has",
      input: "a,b,c\r\nd,e,f\r\ng,h,i",
      config: { preview: 4 },
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
          ["g", "h", "i"],
        ],
        errors: [],
      },
    });
  });

  it("should count rows not lines in preview", () => {
    runParseTest({
      description: "Preview should count rows, not lines",
      input: 'a,b,c\r\nd,e,"f\r\nf",g,h,i',
      config: { preview: 2 },
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f\r\nf", "g", "h", "i"],
        ],
        errors: [],
      },
    });
  });

  it("should handle preview with header row", () => {
    runParseTest({
      description: "Preview with header row",
      input: "a,b,c\r\nd,e,f\r\ng,h,i\r\nj,k,l",
      config: { header: true, preview: 2 },
      expected: {
        data: [
          { a: "d", b: "e", c: "f" },
          { a: "g", b: "h", c: "i" },
        ],
        errors: [],
      },
    });
  });

  it("should handle empty lines", () => {
    runParseTest({
      description: "Empty lines",
      input: "\na,b,c\n\nd,e,f\n\n",
      config: { delimiter: "," },
      expected: {
        data: [[""], ["a", "b", "c"], [""], ["d", "e", "f"], [""], [""]],
        errors: [],
      },
    });
  });

  it("should skip empty lines when configured", () => {
    runParseTest({
      description: "Skip empty lines",
      input: "a,b,c\n\nd,e,f",
      config: { skipEmptyLines: true },
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should skip empty lines with newline at end", () => {
    runParseTest({
      description: "Skip empty lines, with newline at end of input",
      input: "a,b,c\r\n\r\nd,e,f\r\n",
      config: { skipEmptyLines: true },
      expected: {
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
        errors: [],
      },
    });
  });

  it("should skip empty lines with empty input", () => {
    runParseTest({
      description: "Skip empty lines, with empty input",
      input: "",
      config: { skipEmptyLines: true },
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

  it("should not skip lines with only whitespace", () => {
    runParseTest({
      description: "Skip empty lines, with first line only whitespace",
      input: " \na,b,c",
      config: { skipEmptyLines: true, delimiter: "," },
      expected: {
        data: [[" "], ["a", "b", "c"]],
        errors: [],
      },
    });
  });

  it("should skip empty lines while detecting delimiter", () => {
    runParseTest({
      description: "Skip empty lines while detecting delimiter",
      input: "a,b\n1,2\n3,4\n",
      config: { header: true, skipEmptyLines: true },
      expected: {
        data: [
          { a: "1", b: "2" },
          { a: "3", b: "4" },
        ],
        errors: [],
      },
    });
  });

  it("should ignore comment lines when guessing delimiter in escaped file", () => {
    runParseTest({
      description: "Lines with comments are not used when guessing the delimiter in an escaped file",
      input: '#1\n#2\n#3\n#4\n#5\n#6\n#7\n#8\n#9\n#10\none,"t,w,o",three\nfour,five,six',
      config: { comments: "#" },
      expected: {
        data: [
          ["one", "t,w,o", "three"],
          ["four", "five", "six"],
        ],
        errors: [],
      },
    });
  });

  it("should ignore comment lines when guessing delimiter in non-escaped file", () => {
    runParseTest({
      description: "Lines with comments are not used when guessing the delimiter in a non-escaped file",
      input: "#1\n#2\n#3\n#4\n#5\n#6\n#7\n#8\n#9\n#10\n#11\none,two,three\nfour,five,six",
      config: { comments: "#" },
      expected: {
        data: [
          ["one", "two", "three"],
          ["four", "five", "six"],
        ],
        errors: [],
      },
    });
  });

  it("should correctly guess pipe delimiter when mixed with commas", () => {
    runParseTest({
      description: "Pipe delimiter is guessed correctly when mixed with commas",
      input: "one|two,two|three\nfour|five,five|six",
      config: {},
      expected: {
        data: [
          ["one", "two,two", "three"],
          ["four", "five,five", "six"],
        ],
        errors: [],
      },
    });
  });

  it("should handle single quote as quote character", () => {
    runParseTest({
      description: "Single quote as quote character",
      input: "a,b,'c,d'",
      config: { quoteChar: "'" },
      expected: {
        data: [["a", "b", "c,d"]],
        errors: [],
      },
    });
  });

  it("should handle custom escape character in middle", () => {
    runParseTest({
      description: "Custom escape character in the middle",
      input: 'a,b,"c\\"d\\"f"',
      config: { escapeChar: "\\" },
      expected: {
        data: [["a", "b", 'c"d"f']],
        errors: [],
      },
    });
  });

  it("should handle custom escape character at end", () => {
    runParseTest({
      description: "Custom escape character at the end",
      input: 'a,b,"c\\"d\\""',
      config: { escapeChar: "\\" },
      expected: {
        data: [["a", "b", 'c"d"']],
        errors: [],
      },
    });
  });

  it("should handle custom escape character not used for escaping", () => {
    runParseTest({
      description: "Custom escape character not used for escaping",
      input: 'a,b,"c\\d"',
      config: { escapeChar: "\\" },
      expected: {
        data: [["a", "b", "c\\d"]],
        errors: [],
      },
    });
  });

  it("should handle header row with preceding comment", () => {
    runParseTest({
      description: "Header row with preceding comment",
      input: "#Comment\na,b\nc,d\n",
      config: { header: true, comments: "#", skipEmptyLines: true, delimiter: "," },
      expected: {
        data: [{ a: "c", b: "d" }],
        errors: [],
      },
    });
  });

  it("should detect \\r\\n linebreak correctly", () => {
    runParseTest({
      description: "Using \\r\\n endings uses \\r\\n linebreak",
      input: "a,b\r\nc,d\r\ne,f\r\ng,h\r\ni,j",
      config: {},
      expected: {
        data: [
          ["a", "b"],
          ["c", "d"],
          ["e", "f"],
          ["g", "h"],
          ["i", "j"],
        ],
        errors: [],
        meta: {
          linebreak: "\r\n",
          delimiter: ",",
          cursor: 23,
          aborted: false,
          truncated: false,
          renamedHeaders: null,
        },
      },
    });
  });

  it("should detect \\n linebreak correctly", () => {
    runParseTest({
      description: "Using \\n endings uses \\n linebreak",
      input: "a,b\nc,d\ne,f\ng,h\ni,j",
      config: {},
      expected: {
        data: [
          ["a", "b"],
          ["c", "d"],
          ["e", "f"],
          ["g", "h"],
          ["i", "j"],
        ],
        errors: [],
        meta: {
          linebreak: "\n",
          delimiter: ",",
          cursor: 19,
          aborted: false,
          truncated: false,
          renamedHeaders: null,
        },
      },
    });
  });

  it("should handle UTF-8 BOM encoded input", () => {
    runParseTest({
      description: "UTF-8 BOM encoded input is stripped from invisible BOM character",
      input: "\ufeffA,B\nX,Y",
      config: {},
      expected: {
        data: [
          ["A", "B"],
          ["X", "Y"],
        ],
        errors: [],
      },
    });
  });

  it("should handle UTF-8 BOM with header", () => {
    runParseTest({
      description: "UTF-8 BOM encoded input with header produces column key stripped from invisible BOM character",
      input: "\ufeffA,B\nX,Y",
      config: { header: true },
      expected: {
        data: [{ A: "X", B: "Y" }],
        errors: [],
      },
    });
  });

  it("should handle skipEmptyLines set to 'greedy'", () => {
    runParseTest({
      description: "Parsing with skipEmptyLines set to 'greedy'",
      input: 'a,b\n\n,\nc,d\n , \n""," "\n\t,\t\n,,,,\n',
      config: { skipEmptyLines: "greedy" },
      expected: {
        data: [
          ["a", "b"],
          ["c", "d"],
        ],
        errors: [],
      },
    });
  });

  it("should handle greedy skip with quotes and delimiters as content", () => {
    runParseTest({
      description: "Parsing with skipEmptyLines set to 'greedy' with quotes and delimiters as content",
      input: 'a,b\n\n,\nc,d\n" , ",","\n""" """,""""""\n\n\n',
      config: { skipEmptyLines: "greedy" },
      expected: {
        data: [
          ["a", "b"],
          ["c", "d"],
          [" , ", ","],
          ['" "', '""'],
        ],
        errors: [],
      },
    });
  });

  it("should handle skipFirstNLines with header", () => {
    runParseTest({
      description: "Skip First N number of lines, with header and 2 rows",
      input: "to-be-ignored\na,b,c,d\n1,2,3,4",
      config: { header: true, skipFirstNLines: 1 },
      expected: {
        data: [{ a: "1", b: "2", c: "3", d: "4" }],
        errors: [],
      },
    });
  });

  it("should handle skipFirstNLines without header", () => {
    runParseTest({
      description: "Skip First N number of lines, with header false",
      input: "a,b,c,d\n1,2,3,4\n4,5,6,7",
      config: { header: false, skipFirstNLines: 1 },
      expected: {
        data: [
          ["1", "2", "3", "4"],
          ["4", "5", "6", "7"],
        ],
        errors: [],
      },
    });
  });

  it("should handle negative skipFirstNLines", () => {
    runParseTest({
      description: "Skip First N number of lines, with header false and skipFirstNLines as negative value",
      input: "a,b,c,d\n1,2,3,4\n4,5,6,7",
      config: { header: false, skipFirstNLines: -2 },
      expected: {
        data: [
          ["a", "b", "c", "d"],
          ["1", "2", "3", "4"],
          ["4", "5", "6", "7"],
        ],
        errors: [],
      },
    });
  });

  it("should handle skipFirstNLines with custom newline", () => {
    runParseTest({
      description: "Skip first 2 lines, with custom newline character",
      input: "skip-this\rskip-this\r1,2,3,4",
      config: { header: false, skipFirstNLines: 2, newline: "\r" },
      expected: {
        data: [["1", "2", "3", "4"]],
        errors: [],
      },
    });
  });
});
