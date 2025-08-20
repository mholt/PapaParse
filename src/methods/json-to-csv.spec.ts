// @ts-nocheck
/**
 * Unit tests for JSON to CSV serialization function
 * Tests all branches and configuration handling logic
 */

import { describe, expect, mock, test } from "bun:test";
import { JsonToCsv } from "./json-to-csv";

// Mock dependencies
mock.module("../utils", () => ({
  escapeRegExp: mock((str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
}));

mock.module("../constants", () => ({
  CONSTANTS: {
    BAD_DELIMITERS: ["\r", "\n", '"', "\b", "\t", "\\"],
  },
}));

describe("JsonToCsv", () => {
  test("handles array of arrays input", () => {
    const input = [
      ["Name", "Age"],
      ["John", 30],
      ["Jane", 25],
    ];
    const result = JsonToCsv(input);
    expect(result).toBe("Name,Age\r\nJohn,30\r\nJane,25");
  });

  test("handles empty array input", () => {
    const input: any[] = [];
    const result = JsonToCsv(input);
    expect(result).toBe("");
  });

  test("handles array of objects input", () => {
    const input = [
      { name: "John", age: 30 },
      { name: "Jane", age: 25 },
    ];
    const result = JsonToCsv(input);
    expect(result).toBe("name,age\r\nJohn,30\r\nJane,25");
  });

  test("handles object with data array property", () => {
    const input = {
      fields: ["name", "age"],
      data: [
        { name: "John", age: 30 },
        { name: "Jane", age: 25 },
      ],
    };
    const result = JsonToCsv(input);
    expect(result).toBe("name,age\r\nJohn,30\r\nJane,25");
  });

  test("handles object with string data property", () => {
    const input = {
      fields: ["name", "age"],
      data: '[{"name":"John","age":30},{"name":"Jane","age":25}]',
    };
    const result = JsonToCsv(input);
    expect(result).toBe("name,age\r\nJohn,30\r\nJane,25");
  });

  test("handles object with meta.fields when fields missing", () => {
    const input = {
      meta: { fields: ["name", "age"] },
      data: [
        { name: "John", age: 30 },
        { name: "Jane", age: 25 },
      ],
    };
    const result = JsonToCsv(input);
    expect(result).toBe("name,age\r\nJohn,30\r\nJane,25");
  });

  test("handles object with array data when fields missing", () => {
    const input = {
      data: [
        ["John", 30],
        ["Jane", 25],
      ],
    };
    const result = JsonToCsv(input);
    expect(result).toBe("John,30\r\nJane,25");
  });

  test("handles object with simple array data", () => {
    const input = {
      data: [1, 2, 3],
    };
    const result = JsonToCsv(input);
    expect(result).toBe("1,2,3");
  });

  test("handles string input by parsing JSON", () => {
    const input = '[{"name":"John","age":30}]';
    const result = JsonToCsv(input);
    expect(result).toBe("name,age\r\nJohn,30");
  });

  test("throws error for unrecognized input", () => {
    expect(() => {
      JsonToCsv(123 as any);
    }).toThrow("Unable to serialize unrecognized input");
  });

  test("handles custom delimiter configuration", () => {
    const input = [
      ["a", "b"],
      ["1", "2"],
    ];
    const config = { delimiter: "|" };
    const result = JsonToCsv(input, config);
    expect(result).toBe("a|b\r\n1|2");
  });

  test("ignores invalid delimiter with bad characters", () => {
    const input = [
      ["a", "b"],
      ["1", "2"],
    ];
    const config = { delimiter: "\n" }; // Contains bad delimiter
    const result = JsonToCsv(input, config);
    expect(result).toBe("a,b\r\n1,2"); // Falls back to default comma
  });

  test("handles boolean quotes configuration", () => {
    const input = [
      ["a", "b"],
      ["1", "2"],
    ];
    const config = { quotes: true };
    const result = JsonToCsv(input, config);
    expect(result).toBe('"a","b"\r\n"1","2"');
  });

  test("handles function quotes configuration", () => {
    const input = [
      ["a", "b"],
      ["1", "2"],
    ];
    const config = { quotes: (value: any, col: number) => col === 1 };
    const result = JsonToCsv(input, config);
    expect(result).toBe('a,"b"\r\n1,"2"');
  });

  test("handles array quotes configuration", () => {
    const input = [
      ["a", "b"],
      ["1", "2"],
    ];
    const config = { quotes: [false, true] };
    const result = JsonToCsv(input, config);
    expect(result).toBe('a,"b"\r\n1,"2"');
  });

  test("handles skipEmptyLines boolean configuration", () => {
    const input = [["a"], [""], ["b"]];
    const config = { skipEmptyLines: true };
    const result = JsonToCsv(input, config);
    expect(result).toBe("a\r\nb");
  });

  test("handles skipEmptyLines greedy configuration", () => {
    const input = [
      ["a", "b"],
      ["", ""],
      ["c", "d"],
    ];
    const config = { skipEmptyLines: "greedy" } as const;
    const result = JsonToCsv(input, config);
    expect(result).toBe("a,b\r\nc,d");
  });

  test("handles custom newline configuration", () => {
    const input = [["a"], ["b"]];
    const config = { newline: "\n" };
    const result = JsonToCsv(input, config);
    expect(result).toBe("a\nb");
  });

  test("handles custom quote character configuration", () => {
    const input = [["a,b"], ["c,d"]]; // Use values that require quoting
    const config = { quoteChar: "'" };
    const result = JsonToCsv(input, config);
    expect(result).toBe("'a,b'\r\n'c,d'");
  });

  test("handles header false configuration", () => {
    const input = [{ name: "John", age: 30 }];
    const config = { header: false };
    const result = JsonToCsv(input, config);
    expect(result).toBe("John,30");
  });

  test("handles columns configuration", () => {
    const input = [{ name: "John", age: 30, city: "NYC" }];
    const config = { columns: ["name", "city"] };
    const result = JsonToCsv(input, config);
    expect(result).toBe("name,city\r\nJohn,NYC");
  });

  test("throws error for empty columns array", () => {
    expect(() => {
      JsonToCsv([], { columns: [] });
    }).toThrow("Option columns is empty");
  });

  test("handles custom escape character configuration", () => {
    const input = [['with"quote']];
    const config = { escapeChar: "\\" };
    const result = JsonToCsv(input, config);
    expect(result).toBe('"with\\"quote"');
  });

  test("handles escapeFormulae boolean configuration", () => {
    const input = [["=SUM(A1:A2)"], ["+1+1"]];
    const config = { escapeFormulae: true };
    const result = JsonToCsv(input, config);
    expect(result).toBe('"\'=SUM(A1:A2)"\r\n"\'+1+1"');
  });

  test("handles escapeFormulae regex configuration", () => {
    const input = [["=FORMULA"], ["safe"]];
    const config = { escapeFormulae: /^=/ };
    const result = JsonToCsv(input, config);
    expect(result).toBe('"\'=FORMULA"\r\nsafe');
  });

  test("handles null and undefined values", () => {
    const input = [[null, undefined, "value"]];
    const result = JsonToCsv(input);
    expect(result).toBe(",,value");
  });

  test("handles Date objects", () => {
    const date = new Date("2023-01-01T12:00:00.000Z");
    const input = [[date]];
    const result = JsonToCsv(input);
    expect(result).toContain("2023-01-01T12:00:00.000");
  });

  test("handles values with delimiters requiring quotes", () => {
    const input = [["value,with,commas"], ["normal"]];
    const result = JsonToCsv(input);
    expect(result).toBe('"value,with,commas"\r\nnormal');
  });

  test("handles values with leading/trailing spaces requiring quotes", () => {
    const input = [[" leading"], ["trailing "]];
    const result = JsonToCsv(input);
    expect(result).toBe('" leading"\r\n"trailing "');
  });

  test("handles values with quote characters requiring escaping", () => {
    const input = [['value with "quotes"']];
    const result = JsonToCsv(input);
    expect(result).toBe('"value with ""quotes"""');
  });

  test("handles values with bad delimiters requiring quotes", () => {
    const input = [["value\nwith\nnewlines"]];
    const result = JsonToCsv(input);
    expect(result).toBe('"value\nwith\nnewlines"');
  });

  test("handles greedy empty line detection with headers", () => {
    const input = {
      fields: ["name", "age"],
      data: [
        { name: "John", age: 30 },
        { name: "", age: "" },
        { name: "Jane", age: 25 },
      ],
    };
    const config = { skipEmptyLines: "greedy" };
    const result = JsonToCsv(input, config);
    expect(result).toBe("name,age\r\nJohn,30\r\nJane,25");
  });

  test("handles null line detection", () => {
    const input = [["a"], [], ["b"]];
    const result = JsonToCsv(input);
    expect(result).toBe("a\r\n\r\nb");
  });

  test("handles object with empty fields and data", () => {
    const input = {
      fields: [],
      data: [],
    };
    const result = JsonToCsv(input);
    expect(result).toBe("");
  });

  test("handles non-object config", () => {
    const input = [["test"]];
    const result = JsonToCsv(input, null as any);
    expect(result).toBe("test");
  });

  test("handles config with invalid types", () => {
    const input = [["test"]];
    const config = {
      delimiter: 123, // Invalid type
      quotes: "invalid", // Invalid type
      skipEmptyLines: 123, // Invalid type
      newline: 123, // Invalid type
      quoteChar: 123, // Invalid type
      header: "invalid", // Invalid type
      columns: "invalid", // Invalid type
    };
    const result = JsonToCsv(input, config as any);
    expect(result).toBe("test"); // Should use defaults
  });

  test("handles array of objects with missing properties", () => {
    const input = [
      { name: "John", age: 30 },
      { name: "Jane" }, // Missing age
      { age: 25 }, // Missing name
    ];
    const result = JsonToCsv(input);
    expect(result).toBe("name,age\r\nJohn,30\r\nJane,\r\n,25");
  });

  test("handles fields string parsing", () => {
    const input = {
      fields: '["name","age"]',
      data: [["John", 30]],
    };
    const result = JsonToCsv(input);
    expect(result).toBe("name,age\r\nJohn,30");
  });

  test("handles data string parsing", () => {
    const input = {
      fields: ["name", "age"],
      data: '[["John",30]]',
    };
    const result = JsonToCsv(input);
    expect(result).toBe("name,age\r\nJohn,30");
  });
});
