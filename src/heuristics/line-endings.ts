import { escapeRegExp } from "../utils/index.js";

/**
 * Guess the line ending format by analyzing the input text
 * Based on legacy implementation lines 1161-1185
 *
 * @param input - The input text to analyze
 * @param quoteChar - The quote character to ignore when inside quotes (default: '"')
 * @returns The detected line ending ('\n', '\r', or '\r\n')
 */
export function guessLineEndings(
  input: string,
  quoteChar: string = '"',
): string {
  // Limit analysis to first 1MB for performance
  const analysisInput = input.substring(0, 1024 * 1024);

  // Replace all text inside quotes to ignore line endings within quoted fields
  const quotedTextRegex = new RegExp(
    escapeRegExp(quoteChar) + "([^]*?)" + escapeRegExp(quoteChar),
    "gm",
  );
  const inputWithoutQuotes = analysisInput.replace(quotedTextRegex, "");

  // Split on different line ending types
  const crSplit = inputWithoutQuotes.split("\r");
  const lfSplit = inputWithoutQuotes.split("\n");

  // Check if \n appears before \r in the text
  const lfAppearsFirst =
    lfSplit.length > 1 && lfSplit[0].length < crSplit[0].length;

  // If no \r found, or \n appears first, use \n
  if (crSplit.length === 1 || lfAppearsFirst) {
    return "\n";
  }

  // Count how many \r segments start with \n (indicating \r\n)
  let numWithLf = 0;
  for (let i = 0; i < crSplit.length; i++) {
    if (crSplit[i][0] === "\n") {
      numWithLf++;
    }
  }

  // If more than half of \r segments start with \n, it's \r\n, otherwise \r
  return numWithLf >= crSplit.length / 2 ? "\r\n" : "\r";
}

/**
 * Detect all line endings present in the input
 * Useful for validation and compatibility checks
 */
export function detectLineEndings(input: string): {
  hasLF: boolean;
  hasCR: boolean;
  hasCRLF: boolean;
  primary: string;
} {
  const hasLF = input.includes("\n");
  const hasCR = input.includes("\r");
  const hasCRLF = input.includes("\r\n");

  // Determine primary line ending
  let primary: string;
  if (hasCRLF) {
    primary = "\r\n";
  } else if (hasLF) {
    primary = "\n";
  } else if (hasCR) {
    primary = "\r";
  } else {
    primary = "\n"; // default
  }

  return {
    hasLF,
    hasCR,
    hasCRLF,
    primary,
  };
}
