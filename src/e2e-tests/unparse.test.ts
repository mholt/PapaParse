import { describe, it } from "bun:test";
import { runUnparseTest, type UnparseTestCase } from "./test-utils.js";

describe("Unparse Tests", () => {
  it("should unparse a simple row", () => {
    runUnparseTest({
      description: "A simple row",
      input: [["A", "b", "c"]],
      expected: "A,b,c",
    });
  });

  it("should unparse two rows", () => {
    runUnparseTest({
      description: "Two rows",
      input: [
        ["A", "b", "c"],
        ["d", "E", "f"],
      ],
      expected: "A,b,c\r\nd,E,f",
    });
  });

  it("should handle data with quotes", () => {
    runUnparseTest({
      description: "Data with quotes",
      input: [
        ["a", '"b"', "c"],
        ['"d"', "e", "f"],
      ],
      expected: 'a,"""b""",c\r\n"""d""",e,f',
    });
  });

  it("should handle data with newlines", () => {
    runUnparseTest({
      description: "Data with newlines",
      input: [
        ["a", "b\nb", "c"],
        ["d", "e", "f\r\nf"],
      ],
      expected: 'a,"b\nb",c\r\nd,e,"f\r\nf"',
    });
  });

  it("should handle array of objects with header row", () => {
    runUnparseTest({
      description: "Array of objects (header row)",
      input: [
        { Col1: "a", Col2: "b", Col3: "c" },
        { Col1: "d", Col2: "e", Col3: "f" },
      ],
      expected: "Col1,Col2,Col3\r\na,b,c\r\nd,e,f",
    });
  });

  it("should handle missing field in a row", () => {
    runUnparseTest({
      description: "With header row, missing a field in a row",
      input: [
        { Col1: "a", Col2: "b", Col3: "c" },
        { Col1: "d", Col3: "f" },
      ],
      expected: "Col1,Col2,Col3\r\na,b,c\r\nd,,f",
    });
  });

  it("should ignore extra field in a row", () => {
    runUnparseTest({
      description: "With header row, with extra field in a row",
      input: [
        { Col1: "a", Col2: "b", Col3: "c" },
        { Col1: "d", Col2: "e", Extra: "g", Col3: "f" },
      ],
      expected: "Col1,Col2,Col3\r\na,b,c\r\nd,e,f",
    });
  });

  it("should handle specifying column names and data separately", () => {
    runUnparseTest({
      description: "Specifying column names and data separately",
      input: {
        fields: ["Col1", "Col2", "Col3"],
        data: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
      },
      expected: "Col1,Col2,Col3\r\na,b,c\r\nd,e,f",
    });
  });

  it("should handle column names only", () => {
    runUnparseTest({
      description: "Specifying column names only (no data)",
      input: { fields: ["Col1", "Col2", "Col3"] },
      expected: "Col1,Col2,Col3",
    });
  });

  it("should handle data only improperly", () => {
    runUnparseTest({
      description: "Specifying data only (no field names), improperly",
      input: { data: ["abc", "d", "ef"] },
      expected: "abc,d,ef",
    });
  });

  it("should handle data only properly", () => {
    runUnparseTest({
      description: "Specifying data only (no field names), properly",
      input: { data: [["a", "b", "c"]] },
      expected: "a,b,c",
    });
  });

  it("should handle custom delimiter semicolon", () => {
    runUnparseTest({
      description: "Custom delimiter (semicolon)",
      input: [
        ["A", "b", "c"],
        ["d", "e", "f"],
      ],
      config: { delimiter: ";" },
      expected: "A;b;c\r\nd;e;f",
    });
  });

  it("should handle custom delimiter tab", () => {
    runUnparseTest({
      description: "Custom delimiter (tab)",
      input: [
        ["Ab", "cd", "ef"],
        ["g", "h", "ij"],
      ],
      config: { delimiter: "\t" },
      expected: "Ab\tcd\tef\r\ng\th\tij",
    });
  });

  it("should handle custom delimiter ASCII 30", () => {
    const RECORD_SEP = String.fromCharCode(30);
    runUnparseTest({
      description: "Custom delimiter (ASCII 30)",
      input: [
        ["a", "b", "c"],
        ["d", "e", "f"],
      ],
      config: { delimiter: RECORD_SEP },
      expected: "a" + RECORD_SEP + "b" + RECORD_SEP + "c\r\nd" + RECORD_SEP + "e" + RECORD_SEP + "f",
    });
  });

  it("should handle multi-character delimiter", () => {
    runUnparseTest({
      description: "Custom delimiter (Multi-character)",
      input: [
        ["A", "b", "c"],
        ["d", "e", "f"],
      ],
      config: { delimiter: ", " },
      expected: "A, b, c\r\nd, e, f",
    });
  });

  it("should handle multi-character delimiter with field containing delimiter", () => {
    runUnparseTest({
      description: "Custom delimiter (Multi-character), field contains custom delimiter",
      input: [
        ["A", "b", "c"],
        ["d", "e", "f, g"],
      ],
      config: { delimiter: ", " },
      expected: 'A, b, c\r\nd, e, "f, g"',
    });
  });

  it("should default bad delimiter to comma", () => {
    runUnparseTest({
      description: "Bad delimiter (\\n)",
      input: [
        ["a", "b", "c"],
        ["d", "e", "f"],
      ],
      config: { delimiter: "\n" },
      expected: "a,b,c\r\nd,e,f",
    });
  });

  it("should handle custom line ending \\r", () => {
    runUnparseTest({
      description: "Custom line ending (\\r)",
      input: [
        ["a", "b", "c"],
        ["d", "e", "f"],
      ],
      config: { newline: "\r" },
      expected: "a,b,c\rd,e,f",
    });
  });

  it("should handle custom line ending \\n", () => {
    runUnparseTest({
      description: "Custom line ending (\\n)",
      input: [
        ["a", "b", "c"],
        ["d", "e", "f"],
      ],
      config: { newline: "\n" },
      expected: "a,b,c\nd,e,f",
    });
  });

  it("should handle custom strange line ending", () => {
    runUnparseTest({
      description: "Custom, but strange, line ending ($)",
      input: [
        ["a", "b", "c"],
        ["d", "e", "f"],
      ],
      config: { newline: "$" },
      expected: "a,b,c$d,e,f",
    });
  });

  it("should force quotes around all fields", () => {
    runUnparseTest({
      description: "Force quotes around all fields",
      input: [
        ["a", "b", "c"],
        ["d", "e", "f"],
      ],
      config: { quotes: true },
      expected: '"a","b","c"\r\n"d","e","f"',
    });
  });

  it("should force quotes around all fields with header row", () => {
    runUnparseTest({
      description: "Force quotes around all fields (with header row)",
      input: [
        { Col1: "a", Col2: "b", Col3: "c" },
        { Col1: "d", Col2: "e", Col3: "f" },
      ],
      config: { quotes: true },
      expected: '"Col1","Col2","Col3"\r\n"a","b","c"\r\n"d","e","f"',
    });
  });

  it("should force quotes around certain fields only", () => {
    runUnparseTest({
      description: "Force quotes around certain fields only",
      input: [
        ["a", "b", "c"],
        ["d", "e", "f"],
      ],
      config: { quotes: [true, false, true] },
      expected: '"a",b,"c"\r\n"d",e,"f"',
    });
  });

  it("should force quotes around certain fields only with header row", () => {
    runUnparseTest({
      description: "Force quotes around certain fields only (with header row)",
      input: [
        { Col1: "a", Col2: "b", Col3: "c" },
        { Col1: "d", Col2: "e", Col3: "f" },
      ],
      config: { quotes: [true, false, true] },
      expected: '"Col1",Col2,"Col3"\r\n"a",b,"c"\r\n"d",e,"f"',
    });
  });

  it("should force quotes around string fields only", () => {
    runUnparseTest({
      description: "Force quotes around string fields only",
      input: [
        ["a", "b", "c"],
        ["d", 10, true],
      ],
      config: { quotes: (value: any) => typeof value === "string" },
      expected: '"a","b","c"\r\n"d",10,true',
    });
  });

  it("should force quotes around string fields only with header row", () => {
    runUnparseTest({
      description: "Force quotes around string fields only (with header row)",
      input: [
        { Col1: "a", Col2: "b", Col3: "c" },
        { Col1: "d", Col2: 10, Col3: true },
      ],
      config: { quotes: (value: any) => typeof value === "string" },
      expected: '"Col1","Col2","Col3"\r\n"a","b","c"\r\n"d",10,true',
    });
  });

  it("should handle empty input", () => {
    runUnparseTest({
      description: "Empty input",
      input: [],
      expected: "",
    });
  });

  it("should handle mismatched field counts", () => {
    runUnparseTest({
      description: "Mismatched field counts in rows",
      input: [["a", "b", "c"], ["d", "e"], ["f"]],
      expected: "a,b,c\r\nd,e\r\nf",
    });
  });

  it("should treat JSON null as empty value", () => {
    runUnparseTest({
      description: "JSON null is treated as empty value",
      input: [{ Col1: "a", Col2: null, Col3: "c" }],
      expected: "Col1,Col2,Col3\r\na,,c",
    });
  });

  it("should handle custom quote character", () => {
    runUnparseTest({
      description: "Custom quote character (single quote)",
      input: [["a,d", "b", "c"]],
      config: { quoteChar: "'" },
      expected: "'a,d',b,c",
    });
  });

  it("should not print header when header:false", () => {
    runUnparseTest({
      description: "Don't print header if header:false option specified",
      input: [
        { Col1: "a", Col2: "b", Col3: "c" },
        { Col1: "d", Col2: "e", Col3: "f" },
      ],
      config: { header: false },
      expected: "a,b,c\r\nd,e,f",
    });
  });

  it("should export Date objects in ISO representation", () => {
    runUnparseTest({
      description: "Date objects are exported in its ISO representation",
      input: [
        { date: new Date("2018-05-04T21:08:03.269Z"), "not a date": 16 },
        { date: new Date("Tue May 08 2018 08:20:22 GMT-0700 (PDT)"), "not a date": 32 },
      ],
      expected: "date,not a date\r\n2018-05-04T21:08:03.269Z,16\r\n2018-05-08T15:20:22.000Z,32",
    });
  });

  it("should return empty rows when skipEmptyLines is false", () => {
    runUnparseTest({
      description: "Returns empty rows when empty rows are passed and skipEmptyLines is false",
      input: [[null, " "], [], ["1", "2"]],
      config: { skipEmptyLines: false },
      expected: '," "\r\n\r\n1,2',
    });
  });

  it("should skip empty rows when skipEmptyLines is true", () => {
    runUnparseTest({
      description: "Returns without empty rows when skipEmptyLines is true",
      input: [[null, " "], [], ["1", "2"]],
      config: { skipEmptyLines: true },
      expected: '," "\r\n1,2',
    });
  });

  it("should skip rows with no content when skipEmptyLines is 'greedy'", () => {
    runUnparseTest({
      description: "Returns without rows with no content when skipEmptyLines is 'greedy'",
      input: [[null, " "], [], ["1", "2"], ["3", "4"]],
      config: { skipEmptyLines: "greedy" },
      expected: "1,2\r\n3,4",
    });
  });

  it("should return empty rows with headers when skipEmptyLines is false", () => {
    runUnparseTest({
      description: "Returns empty rows when empty rows are passed and skipEmptyLines is false with headers",
      input: [{ a: null, b: " " }, {}, { a: "1", b: "2" }],
      config: { skipEmptyLines: false, header: true },
      expected: 'a,b\r\n," "\r\n\r\n1,2',
    });
  });

  it("should skip empty rows with headers when skipEmptyLines is true", () => {
    runUnparseTest({
      description: "Returns without empty rows when empty rows are passed and skipEmptyLines is true with headers",
      input: [{ a: null, b: " " }, {}, { a: "1", b: "2" }],
      config: { skipEmptyLines: true, header: true },
      expected: 'a,b\r\n," "\r\n1,2',
    });
  });

  it("should skip rows with no content with headers when skipEmptyLines is 'greedy'", () => {
    runUnparseTest({
      description: "Returns without rows with no content when skipEmptyLines is 'greedy' with headers",
      input: [{ a: null, b: " " }, {}, { a: "1", b: "2" }],
      config: { skipEmptyLines: "greedy", header: true },
      expected: "a,b\r\n1,2",
    });
  });
});
