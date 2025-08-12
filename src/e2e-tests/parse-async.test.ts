import { describe, expect, it } from "bun:test";
import Papa from "../index.js";
import { type AsyncTestCase, createTestFile, runAsyncParseTest } from "./test-utils.js";

describe("Parse Async Tests", () => {
  it.skip("should handle simple worker", async () => {
    await runAsyncParseTest({
      description: "Simple worker",
      input: "A,B,C\nX,Y,Z",
      config: { worker: true },
      expected: {
        data: [
          ["A", "B", "C"],
          ["X", "Y", "Z"],
        ],
        errors: [],
      },
    });
  });

  it("should handle simple file", async () => {
    await runAsyncParseTest({
      description: "Simple file",
      input: createTestFile("A,B,C\nX,Y,Z", "sample.csv"),
      config: {},
      expected: {
        data: [
          ["A", "B", "C"],
          ["X", "Y", "Z"],
        ],
        errors: [],
      },
    });
  });

  it.skip("should handle simple file with worker", async () => {
    await runAsyncParseTest({
      description: "Simple file + worker",
      input: createTestFile("A,B,C\nX,Y,Z", "sample.csv"),
      config: { worker: true },
      expected: {
        data: [
          ["A", "B", "C"],
          ["X", "Y", "Z"],
        ],
        errors: [],
      },
    });
  });

  it("should handle file with regular and empty lines", async () => {
    const largeContent = "A,B,C\nX,Y,Z\n" + new Array(1000).fill(",,").join("\n");
    await runAsyncParseTest({
      description: "File with a few regular and lots of empty lines",
      input: createTestFile(largeContent, "sample.csv"),
      config: { skipEmptyLines: "greedy" },
      expected: {
        data: [
          ["A", "B", "C"],
          ["X", "Y", "Z"],
        ],
        errors: [],
      },
    });
  });

  it.skip("should handle file with regular and empty lines with worker", async () => {
    const largeContent = "A,B,C\nX,Y,Z\n" + new Array(1000).fill(",,").join("\n");
    await runAsyncParseTest({
      description: "File with a few regular and lots of empty lines + worker",
      input: createTestFile(largeContent, "sample.csv"),
      config: { worker: true, skipEmptyLines: "greedy" },
      expected: {
        data: [
          ["A", "B", "C"],
          ["X", "Y", "Z"],
        ],
        errors: [],
      },
    });
  });

  it("should handle file with header and dynamic typing", async () => {
    await runAsyncParseTest({
      description: "File with header and dynamic typing",
      input: createTestFile("name,age,active\nJohn,25,true\nJane,30,false", "people.csv"),
      config: { header: true, dynamicTyping: true },
      expected: {
        data: [
          { name: "John", age: 25, active: true },
          { name: "Jane", age: 30, active: false },
        ],
        errors: [],
      },
    });
  });

  it("should handle file with comments", async () => {
    await runAsyncParseTest({
      description: "File with comments",
      input: createTestFile("# This is a comment\nA,B,C\n# Another comment\nX,Y,Z", "commented.csv"),
      config: { comments: "#" },
      expected: {
        data: [
          ["A", "B", "C"],
          ["X", "Y", "Z"],
        ],
        errors: [],
      },
    });
  });

  it("should handle file with custom delimiter", async () => {
    await runAsyncParseTest({
      description: "File with custom delimiter",
      input: createTestFile("A;B;C\nX;Y;Z", "semicolon.csv"),
      config: { delimiter: ";" },
      expected: {
        data: [
          ["A", "B", "C"],
          ["X", "Y", "Z"],
        ],
        errors: [],
      },
    });
  });

  it("should handle file with quoted fields containing newlines", async () => {
    await runAsyncParseTest({
      description: "File with quoted fields containing newlines",
      input: createTestFile('A,B,C\n"Line 1\nLine 2",Y,Z', "multiline.csv"),
      config: {},
      expected: {
        data: [
          ["A", "B", "C"],
          ["Line 1\nLine 2", "Y", "Z"],
        ],
        errors: [],
      },
    });
  });

  it("should handle file with transform function", async () => {
    await runAsyncParseTest({
      description: "File with transform function",
      input: createTestFile("A,B,C\nX,Y,Z", "transform.csv"),
      config: {
        transform: (value: string) => value.toLowerCase(),
      },
      expected: {
        data: [
          ["a", "b", "c"],
          ["x", "y", "z"],
        ],
        errors: [],
      },
    });
  });

  it("should handle file with preview", async () => {
    await runAsyncParseTest({
      description: "File with preview",
      input: createTestFile("A,B,C\nX,Y,Z\nP,Q,R", "preview.csv"),
      config: { preview: 2 },
      expected: {
        data: [
          ["A", "B", "C"],
          ["X", "Y", "Z"],
        ],
        errors: [],
      },
    });
  });

  it("should handle file with skipEmptyLines", async () => {
    await runAsyncParseTest({
      description: "File with skipEmptyLines",
      input: createTestFile("A,B,C\n\nX,Y,Z\n\n", "empty-lines.csv"),
      config: { skipEmptyLines: true },
      expected: {
        data: [
          ["A", "B", "C"],
          ["X", "Y", "Z"],
        ],
        errors: [],
      },
    });
  });

  it("should handle large file efficiently", async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => `row${i},data${i},value${i}`);
    const content = "col1,col2,col3\n" + rows.join("\n");

    await runAsyncParseTest({
      description: "Large file",
      input: createTestFile(content, "large.csv"),
      config: { header: true },
      expected: {
        data: rows.map((_, i) => ({
          col1: `row${i}`,
          col2: `data${i}`,
          col3: `value${i}`,
        })),
        errors: [],
      },
    });
  });

  it("should handle file with malformed quotes", async () => {
    await runAsyncParseTest({
      description: "File with malformed quotes",
      input: createTestFile('A,B,C\n"unclosed quote,Y,Z\nX,Y,Z', "malformed.csv"),
      config: {},
      expected: {
        data: [["A", "B", "C"], ["unclosed quote,Y,Z\nX,Y,Z"]],
        errors: [
          {
            type: "Quotes",
            code: "MissingQuotes",
            message: "Quoted field unterminated",
            row: 0,
            index: 7,
          },
        ],
      },
    });
  });

  it.skip("should handle file with worker and step function", async () => {
    const stepResults: any[] = [];

    await new Promise<void>((resolve, reject) => {
      const input = createTestFile("A,B,C\nX,Y,Z\nP,Q,R", "step.csv");

      Papa.parse(input, {
        worker: true,
        step: (results: any) => {
          stepResults.push(results.data);
        },
        complete: () => {
          try {
            expect(stepResults).toHaveLength(3);
            expect(stepResults[0]).toEqual(["A", "B", "C"]);
            expect(stepResults[1]).toEqual(["X", "Y", "Z"]);
            expect(stepResults[2]).toEqual(["P", "Q", "R"]);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        error: reject,
      });
    });
  });

  it("should handle file with chunkSize", async () => {
    await runAsyncParseTest({
      description: "File with chunkSize",
      input: createTestFile("A,B,C\nX,Y,Z\nP,Q,R\nM,N,O", "chunked.csv"),
      config: { chunkSize: 10 },
      expected: {
        data: [
          ["A", "B", "C"],
          ["X", "Y", "Z"],
          ["P", "Q", "R"],
          ["M", "N", "O"],
        ],
        errors: [],
      },
    });
  });
});
