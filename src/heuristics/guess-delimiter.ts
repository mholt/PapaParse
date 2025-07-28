import { PapaParseConfig } from "../types/index.js";
import { CONSTANTS } from "../constants/index.js";
import { Parser } from "../core/parser.js";

export interface DelimiterGuessResult {
  successful: boolean;
  bestDelimiter: string | undefined;
}

export interface DelimiterGuessOptions {
  newline?: "\r" | "\n" | "\r\n";
  skipEmptyLines?: boolean | "greedy";
  comments?: false | string;
  delimitersToGuess?: string[];
}

/**
 * Test if a row is empty based on skipEmptyLines configuration
 */
function testEmptyLine(
  row: string[],
  skipEmptyLines: boolean | "greedy",
): boolean {
  return skipEmptyLines === "greedy"
    ? row.join("").trim() === ""
    : row.length === 1 && row[0].length === 0;
}

/**
 * Guess the delimiter by parsing the input with different delimiters
 * and choosing the one that produces the most consistent field counts
 *
 * Based on legacy implementation lines 1340-1392
 */
export function guessDelimiter(
  input: string,
  options: DelimiterGuessOptions = {},
): DelimiterGuessResult {
  const {
    newline,
    skipEmptyLines = false,
    comments = false as false | string,
    delimitersToGuess = [
      ",",
      "\t",
      "|",
      ";",
      CONSTANTS.RECORD_SEP,
      CONSTANTS.UNIT_SEP,
    ],
  } = options;

  let bestDelim: string | undefined;
  let bestDelta: number | undefined;
  let maxFieldCount: number | undefined;

  for (const delim of delimitersToGuess) {
    let delta = 0;
    let avgFieldCount = 0;
    let emptyLinesCount = 0;
    let fieldCountPrevRow: number | undefined;

    // Parse a preview with this delimiter
    const config: PapaParseConfig = {
      comments,
      delimiter: delim,
      newline,
      preview: 10,
    };

    const parser = new Parser(config);
    const preview = parser.parse(input);

    // Analyze field count consistency
    for (const row of preview.data) {
      if (skipEmptyLines && testEmptyLine(row, skipEmptyLines)) {
        emptyLinesCount++;
        continue;
      }

      const fieldCount = row.length;
      avgFieldCount += fieldCount;

      if (typeof fieldCountPrevRow === "undefined") {
        fieldCountPrevRow = fieldCount;
        continue;
      } else if (fieldCount > 0) {
        delta += Math.abs(fieldCount - fieldCountPrevRow);
        fieldCountPrevRow = fieldCount;
      }
    }

    if (preview.data.length > 0) {
      avgFieldCount /= preview.data.length - emptyLinesCount;
    }

    // Choose delimiter with lowest delta (most consistent) and highest field count
    if (
      (typeof bestDelta === "undefined" || delta <= bestDelta) &&
      (typeof maxFieldCount === "undefined" || avgFieldCount > maxFieldCount) &&
      avgFieldCount > 1.99
    ) {
      bestDelta = delta;
      bestDelim = delim;
      maxFieldCount = avgFieldCount;
    }
  }

  return {
    successful: !!bestDelim,
    bestDelimiter: bestDelim,
  };
}
