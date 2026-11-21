import { describe, expect, it } from "bun:test";
import { Readable } from "node:stream";
import Papa from "../index.js";
import type { PapaParseResult } from "../types/index.js";

describe("Comment metadata", () => {
  for (const fastMode of [undefined, false, true]) {
    it(`retains embedded metadata with fastMode=${fastMode}`, () => {
      const comments = ["# publisher City of Palo Alto", "#datatype string,string"];
      const result = Papa.parse(`${comments.join("\n")}\nGID,On Street\n1,ADDISON AV`, {
        delimiter: ",",
        comments: "#",
        fastMode,
      });

      expect(result.data).toEqual([
        ["GID", "On Street"],
        ["1", "ADDISON AV"],
      ]);
      expect(result.meta.comments).toEqual(comments);
      expect(result.errors).toEqual([]);
    });
  }

  it("keeps quoted comment markers and embedded newlines as data", () => {
    const input = '# publisher "City"\n"#literal","two\n#value"\n# tail';
    const result = Papa.parse(input, { delimiter: ",", comments: "#" });

    expect(result.data).toEqual([["#literal", "two\n#value"]]);
    expect(result.meta.comments).toEqual(['# publisher "City"', "# tail"]);
    expect(result.meta.cursor).toBe(input.length);
    expect(result.errors).toEqual([]);
  });

  it("leaves metadata unchanged when comments are disabled", () => {
    const result = Papa.parse("#literal,value\na,1", { delimiter: "," });

    expect(result.data).toEqual([
      ["#literal", "value"],
      ["a", "1"],
    ]);
    expect("comments" in result.meta).toBe(false);
  });

  it("retains a comment-only file without creating data rows", () => {
    const input = "# first\r# second";
    const result = Papa.parse(input, { delimiter: ",", newline: "\r", comments: "#", fastMode: false });

    expect(result.data).toEqual([]);
    expect(result.meta.comments).toEqual(["# first", "# second"]);
    expect(result.meta.cursor).toBe(input.length);
  });

  for (const chunkSize of [1, 2, 7]) {
    it(`retains complete comments once across ${chunkSize}-character chunks`, () => {
      const input = '// first "quoted"\r\na,1\r\n// middle\r\nb,2\r\n// tail';
      const data: string[][] = [];
      const comments: string[] = [];
      let cursor = 0;

      Papa.parse(input, {
        delimiter: ",",
        newline: "\r\n",
        comments: "//",
        chunkSize,
        chunk(results) {
          data.push(...results.data);
          comments.push(...(results.meta.comments || []));
          cursor = results.meta.cursor;
        },
      });

      expect(data).toEqual([
        ["a", "1"],
        ["b", "2"],
      ]);
      expect(comments).toEqual(['// first "quoted"', "// middle", "// tail"]);
      expect(cursor).toBe(input.length);
    });
  }

  it("accumulates comments when reading a Node stream without streaming callbacks", async () => {
    const input = "# first\na,1\n# middle\nb,2\n# tail";
    const chunks = [input.slice(0, 3), input.slice(3, 14), input.slice(14, 26), input.slice(26)];
    const result = await new Promise<PapaParseResult>((resolve, reject) => {
      Papa.parse(Readable.from(chunks), {
        delimiter: ",",
        newline: "\n",
        comments: "#",
        complete: resolve,
        error: reject,
      });
    });

    expect(result.data).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
    expect(result.meta.comments).toEqual(["# first", "# middle", "# tail"]);
    expect(result.meta.cursor).toBe(input.length);
    expect(result.errors).toEqual([]);
  });

  for (const pause of [false, true]) {
    it(`retains comments around headers and skipped rows in step callbacks (pause=${pause})`, async () => {
      const input = "# publisher\nname,value\n\n# row\none,1\n# between\n\n# second\ntwo,2\n# tail";
      const data: unknown[] = [];
      const comments: (string[] | undefined)[] = [];
      const result = await new Promise<PapaParseResult>((resolve, reject) => {
        Papa.parse(input, {
          delimiter: ",",
          newline: "\n",
          comments: "#",
          header: true,
          skipEmptyLines: true,
          chunkSize: 17,
          step(results, handle) {
            data.push(results.data);
            comments.push(results.meta.comments);
            if (pause && data.length === 1) {
              handle.pause();
              setTimeout(() => handle.resume(), 0);
            }
          },
          complete: resolve,
          error: reject,
        });
      });

      expect(data).toEqual([
        { name: "one", value: "1" },
        { name: "two", value: "2" },
      ]);
      expect(comments).toEqual([
        ["# publisher", "# row"],
        ["# between", "# second"],
      ]);
      expect(result.meta.comments).toEqual(["# tail"]);
    });
  }

  for (const fastMode of [undefined, false]) {
    it(`stops collecting comments at the preview limit with fastMode=${fastMode}`, () => {
      const result = Papa.parse("# first\na,1\n# excluded\nb,2", {
        delimiter: ",",
        comments: "#",
        fastMode,
        preview: 1,
      });

      expect(result.data).toEqual([["a", "1"]]);
      expect(result.meta.comments).toEqual(["# first"]);
    });
  }
});
