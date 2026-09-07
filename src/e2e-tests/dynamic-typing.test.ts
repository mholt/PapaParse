import { describe, expect, it } from "bun:test";
import Papa, { parseDynamic } from "../index.js";
import { runParseTest } from "./test-utils.js";

describe("Dynamic typing of numbers with a leading plus", () => {
  for (const fastMode of [true, false]) {
    describe(`fastMode: ${fastMode}`, () => {
      it("converts signed integers, decimals and scientific notation", () => {
        runParseTest({
          description: "Leading plus signs are accepted in numeric fields (#1070)",
          input: "+1.5E-03,+2.000000E+00,+0.000000E+00,+1e3,+42,+.5,+2., +3.5 ,1.5E-03,-1.5E-03",
          config: { delimiter: ",", dynamicTyping: true, fastMode },
          expected: {
            data: [[0.0015, 2, 0, 1000, 42, 0.5, 2, 3.5, 0.0015, -0.0015]],
            errors: [],
          },
        });
      });

      it("keeps malformed signed numbers as strings", () => {
        runParseTest({
          description: "Only a single leading sign is accepted",
          input: "+,++,++1,+-1,-+1,+ 1,+1e,+1e+-2,+Infinity,+0x10",
          config: { delimiter: ",", dynamicTyping: true, fastMode },
          expected: {
            data: [["+", "++", "++1", "+-1", "-+1", "+ 1", "+1e", "+1e+-2", "+Infinity", "+0x10"]],
            errors: [],
          },
        });
      });

      it("preserves the existing numeric range limits", () => {
        runParseTest({
          description: "Leading plus signs do not bypass numeric range validation",
          input: "+9007199254740991,+9007199254740992,+9007199254740993,+9.007199254740992E15,+1e309",
          config: { delimiter: ",", dynamicTyping: true, fastMode },
          expected: {
            data: [[9007199254740991, "+9007199254740992", "+9007199254740993", "+9.007199254740992E15", "+1e309"]],
            errors: [],
          },
        });
      });

      it("keeps leading plus signs when dynamic typing is disabled", () => {
        runParseTest({
          description: "Disabling dynamic typing preserves signed numeric text",
          input: "+1.5E-03,+42,+.5",
          config: { delimiter: ",", dynamicTyping: false, fastMode },
          expected: {
            data: [["+1.5E-03", "+42", "+.5"]],
            errors: [],
          },
        });
      });
    });
  }

  it("converts leading plus signs in the fast parser before handle processing", () => {
    const parser = new Papa.Parser({ delimiter: ",", dynamicTyping: true, fastMode: true });
    const result = parser.parse("+1.5E-03,+42,+.5");

    expect(result.errors).toEqual([]);
    expect(result.data).toEqual([[0.0015, 42, 0.5]]);
  });

  it("converts leading plus signs in the exported dynamic typing helper", () => {
    expect(parseDynamic("value", "+1.5E-03", { dynamicTyping: true })).toBe(0.0015);
    expect(parseDynamic("value", "+42", { dynamicTyping: true })).toBe(42);
    expect(parseDynamic("value", "+.5", { dynamicTyping: true })).toBe(0.5);
  });
});
