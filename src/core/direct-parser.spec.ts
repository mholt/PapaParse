import { describe, expect, test } from "bun:test";
import { DirectParser } from "./direct-parser";

describe("DirectParser boolean dynamic typing", () => {
  test("converts lowercase, uppercase, and title-case booleans", () => {
    const parser = new DirectParser({ dynamicTyping: true });
    const result = parser.parse("true,false,TRUE,FALSE,True,False");

    expect(result.data).toEqual([[true, false, true, false, true, false]]);
    expect(result.errors).toEqual([]);
  });

  test("preserves unsupported spellings and surrounding whitespace", () => {
    const parser = new DirectParser({ dynamicTyping: true });
    const values = ["T", "F", "tRuE", "fAlSe", " True", "True ", " False", "False "];

    expect(parser.parse(values.join(",")).data).toEqual([values]);
  });

  test("preserves title-case booleans when dynamic typing is disabled", () => {
    const parser = new DirectParser({ dynamicTyping: false });

    expect(parser.parse("True,False").data).toEqual([["True", "False"]]);
  });
});
