import { describe, expect, it } from "bun:test";
import Papa from "../index.js";
import { type CustomTestCase, runCustomTest } from "./test-utils.js";

describe("Custom Streaming Tests", () => {
  it("should parse correctly with steps", async () => {
    await runCustomTest({
      description: "Parse with steps",
      expected: [
        ["A", "b", "c"],
        ["d", "E", "f"],
        ["G", "h", "i"],
      ],
      run: (callback) => {
        const data: any[] = [];
        Papa.parse("A,b,c\nd,E,f\nG,h,i", {
          step: (results) => {
            data.push(results.data);
          },
          complete: () => {
            callback(data);
          },
        });
      },
    });
  });

  it("should skip empty lines correctly with steps", async () => {
    await runCustomTest({
      description: "Data is correctly parsed with steps and skipEmptyLines",
      expected: [
        ["A", "b", "c"],
        ["d", "E", "f"],
      ],
      run: (callback) => {
        const data: any[] = [];
        Papa.parse("A,b,c\n\nd,E,f", {
          skipEmptyLines: true,
          step: (results) => {
            data.push(results.data);
          },
          complete: () => {
            callback(data);
          },
        });
      },
    });
  });

  it("should correctly parse with steps when there are empty values", async () => {
    await runCustomTest({
      description: "Data is correctly parsed with steps when there are empty values",
      expected: [
        { A: "a", B: "b", C: "c", D: "d" },
        { A: "a", B: "", C: "", D: "" },
      ],
      run: (callback) => {
        const data: any[] = [];
        Papa.parse("A,B,C,D\na,b,c,d\na,,,", {
          header: true,
          step: (results) => {
            data.push(results.data);
          },
          complete: () => {
            callback(data);
          },
        });
      },
    });
  });

  it("should call step with row contents", async () => {
    await runCustomTest({
      description: "Step is called with the contents of the row",
      expected: ["A", "b", "c"],
      run: (callback) => {
        Papa.parse("A,b,c", {
          step: (response) => {
            callback(response.data);
          },
        });
      },
    });
  });

  it("should expose cursor position in step", async () => {
    await runCustomTest({
      description: "Step is called with the last cursor position",
      expected: [6, 12, 17],
      run: (callback) => {
        const updates: number[] = [];
        Papa.parse("A,b,c\nd,E,f\nG,h,i", {
          step: (response) => {
            updates.push(response.meta.cursor);
          },
          complete: () => {
            callback(updates);
          },
        });
      },
    });
  });

  it("should handle chunk functions that pause parsing", async () => {
    await runCustomTest({
      description: "Chunk functions can pause parsing",
      expected: [[["A", "b", "c"]]],
      run: (callback) => {
        const updates: any[] = [];
        Papa.parse("A,b,c\nd,E,f\nG,h,i", {
          chunkSize: 10,
          chunk: (response, handle) => {
            updates.push(response.data);
            handle.pause();
            callback(updates);
          },
          complete: () => {
            callback(new Error("incorrect complete callback"));
          },
        });
      },
    });
  });

  it("should handle chunk functions that resume parsing", async () => {
    await runCustomTest({
      description: "Chunk functions can resume parsing",
      expected: [
        [["A", "b", "c"]],
        [
          ["d", "E", "f"],
          ["G", "h", "i"],
        ],
      ],
      run: (callback) => {
        const updates: any[] = [];
        let handle: any = null;
        let first = true;

        Papa.parse("A,b,c\nd,E,f\nG,h,i", {
          chunkSize: 10,
          chunk: (response, h) => {
            updates.push(response.data);
            if (!first) return;
            handle = h;
            handle.pause();
            first = false;
          },
          complete: () => {
            callback(updates);
          },
        });

        setTimeout(() => {
          handle.resume();
        }, 100);
      },
    });
  });

  it("should handle chunk functions that abort parsing", async () => {
    await runCustomTest({
      description: "Chunk functions can abort parsing",
      expected: [[["A", "b", "c"]]],
      run: (callback) => {
        const updates: any[] = [];
        Papa.parse("A,b,c\nd,E,f\nG,h,i", {
          chunkSize: 1,
          chunk: (response, handle) => {
            if (response.data.length) {
              updates.push(response.data);
              handle.abort();
            }
          },
          complete: (response) => {
            callback(updates);
          },
        });
      },
    });
  });

  it("should handle step functions that abort parsing", async () => {
    await runCustomTest({
      description: "Step functions can abort parsing",
      expected: [["A", "b", "c"]],
      run: (callback) => {
        const updates: any[] = [];
        Papa.parse("A,b,c\nd,E,f\nG,h,i", {
          step: (response, handle) => {
            updates.push(response.data);
            handle.abort();
            callback(updates);
          },
          chunkSize: 6,
        });
      },
    });
  });

  it("should call complete after aborting", async () => {
    await runCustomTest({
      description: "Complete is called after aborting",
      expected: true,
      run: (callback) => {
        Papa.parse("A,b,c\nd,E,f\nG,h,i", {
          step: (response, handle) => {
            handle.abort();
          },
          chunkSize: 6,
          complete: (response) => {
            callback(response.meta.aborted);
          },
        });
      },
    });
  });

  it("should handle step functions that pause parsing", async () => {
    await runCustomTest({
      description: "Step functions can pause parsing",
      expected: [["A", "b", "c"]],
      run: (callback) => {
        const updates: any[] = [];
        Papa.parse("A,b,c\nd,E,f\nG,h,i", {
          step: (response, handle) => {
            updates.push(response.data);
            handle.pause();
            callback(updates);
          },
          complete: () => {
            callback("incorrect complete callback");
          },
        });
      },
    });
  });

  it("should handle step functions that resume parsing", async () => {
    await runCustomTest({
      description: "Step functions can resume parsing",
      expected: [
        ["A", "b", "c"],
        ["d", "E", "f"],
        ["G", "h", "i"],
      ],
      run: (callback) => {
        const updates: any[] = [];
        let handle: any = null;
        let first = true;

        Papa.parse("A,b,c\nd,E,f\nG,h,i", {
          step: (response, h) => {
            updates.push(response.data);
            if (!first) return;
            handle = h;
            handle.pause();
            first = false;
          },
          complete: () => {
            callback(updates);
          },
        });

        setTimeout(() => {
          handle.resume();
        }, 100);
      },
    });
  });

  it("should correctly guess custom delimiters", async () => {
    await runCustomTest({
      description: "Should correctly guess custom delimiter when passed delimiters to guess",
      expected: "~",
      run: (callback) => {
        const results = Papa.parse('"A"~"B"~"C"~"D"', {
          delimitersToGuess: ["~", "@", "%"],
        });
        callback(results.meta.delimiter);
      },
    });
  });

  it("should correctly guess default delimiters", async () => {
    await runCustomTest({
      description: "Should still correctly guess default delimiters when delimiters to guess are not given",
      expected: ",",
      run: (callback) => {
        const results = Papa.parse('"A","B","C","D"');
        callback(results.meta.delimiter);
      },
    });
  });

  it("should handle data with chunks and duplicated headers", async () => {
    await runCustomTest({
      description: "Data is correctly parsed with chunks and duplicated headers",
      expected: [
        { h0: "a", h1: "a" },
        { h0: "b", h1: "b" },
      ],
      run: (callback) => {
        const data: any[] = [];
        Papa.parse("h0,h1\na,a\nb,b", {
          header: true,
          chunkSize: 10,
          chunk: (results) => {
            data.push(results.data[0]);
          },
          complete: () => {
            callback(data);
          },
        });
      },
    });
  });

  it("should handle beforeFirstChunk manipulation", async () => {
    await runCustomTest({
      description: "beforeFirstChunk manipulates only first chunk",
      expected: 2,
      run: (callback) => {
        let updates = 0;
        const content = "header1,header2,header3\nrow1,data1,value1\nrow2,data2,value2";

        Papa.parse(content, {
          beforeFirstChunk: (chunk) => {
            return chunk.replace(/.*?\n/, ""); // Remove first line
          },
          step: (response) => {
            updates++;
          },
          complete: () => {
            callback(updates);
          },
        });
      },
    });
  });

  it("should not modify first chunk if beforeFirstChunk returns nothing", async () => {
    await runCustomTest({
      description: "First chunk not modified if beforeFirstChunk returns nothing",
      expected: 3,
      run: (callback) => {
        let updates = 0;
        const content = "header1,header2,header3\nrow1,data1,value1\nrow2,data2,value2";

        Papa.parse(content, {
          beforeFirstChunk: (chunk) => {
            // Return nothing
          },
          step: (response) => {
            updates++;
          },
          complete: () => {
            callback(updates);
          },
        });
      },
    });
  });

  it("should handle streaming with various data types", async () => {
    await runCustomTest({
      description: "Streaming with various data types and dynamic typing",
      expected: [
        ["number", "boolean", "string"],
        [123, true, "text"],
        [45.6, false, "more text"],
      ],
      run: (callback) => {
        const data: any[] = [];
        Papa.parse("number,boolean,string\n123,true,text\n45.6,false,more text", {
          dynamicTyping: true,
          step: (results) => {
            data.push(results.data);
          },
          complete: () => {
            callback(data);
          },
        });
      },
    });
  });

  it("should handle streaming with transform function", async () => {
    await runCustomTest({
      description: "Streaming with transform function",
      expected: [
        ["A", "b", "C"],
        ["D", "e", "F"],
      ],
      run: (callback) => {
        const data: any[] = [];
        Papa.parse("a,B,c\nd,E,f", {
          transform: (value: string, column: number) => (column % 2 === 0 ? value.toUpperCase() : value.toLowerCase()),
          step: (results) => {
            data.push(results.data);
          },
          complete: () => {
            callback(data);
          },
        });
      },
    });
  });
});
