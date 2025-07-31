/**
 * Direct CSV parser optimized for fast mode
 *
 * Bypasses tokenization entirely and directly produces data arrays
 * to match legacy fast mode performance. This parser is used when:
 * - No quotes are detected in input
 * - fastMode is explicitly enabled
 * - Maximum performance is required
 *
 * Based on legacy fast mode (lines 1482-1513)
 */

import { CONSTANTS } from "../constants/index.js";
import type { PapaParseConfig, PapaParseError, PapaParseResult } from "../types/index.js";

/**
 * High-performance direct parser that mimics legacy fast mode
 */
export class DirectParser {
  private aborted = false;

  constructor(private config: PapaParseConfig) { }

  /**
   * Parse CSV directly to data arrays without tokenization
   */
  parse(input: string): PapaParseResult {
    // Cache config values for performance
    const delimiter: string =
      typeof this.config.delimiter === "function"
        ? this.config.delimiter(input)
        : this.config.delimiter || CONSTANTS.DefaultDelimiter;
    const newline = this.config.newline || "\n";
    const comments = this.config.comments;
    const commentsLen = (comments && comments.length) || 0;
    const skipEmptyLines = this.config.skipEmptyLines;
    const preview = this.config.preview;
    const step = this.config.step;
    const header = this.config.header;
    const transform = this.config.transform;
    const dynamicTyping = this.config.dynamicTyping;

    const meta: any = {
      delimiter,
      linebreak: newline,
      aborted: false,
      truncated: false,
      cursor: 0,
    };

    if (!input) {
      return { data: [], errors: [], meta };
    }

    // Single-pass streaming with zero-copy slices (best of both worlds)
    // Avoids both substring() copies and upfront split() overhead
    const data: any[][] = [];
    const errors: PapaParseError[] = [];
    const delimCode = delimiter.charCodeAt(0);
    const newLen = newline.length;
    const isTypingFunction = typeof dynamicTyping === "function";

    let processedRows = 0;
    let rowStart = 0;

    // Single linear scan with zero-copy field extraction
    while (rowStart < input.length && !this.aborted) {
      // Find next newline efficiently
      const nlIdx = input.indexOf(newline, rowStart);
      const rowEnd = nlIdx === -1 ? input.length : nlIdx;
      const rowLen = rowEnd - rowStart;

      // Skip empty rows early
      if (rowLen === 0) {
        rowStart = rowEnd + newLen;
        continue;
      }

      // Skip comment lines by checking directly on input string
      if (comments && input.startsWith(comments, rowStart)) {
        rowStart = rowEnd + newLen;
        continue;
      }

      // Extract fields in-place using zero-copy slices
      const fields: any[] = [];
      let fStart = rowStart;

      // Optimized single-character delimiter path
      for (let i = rowStart; i <= rowEnd; i++) {
        if (i === rowEnd || input.charCodeAt(i) === delimCode) {
          let value = input.slice(fStart, i); // zero-copy slice

          // Apply transforms and dynamic typing
          if (transform) {
            value = transform(value, fields.length);
          }
          if (dynamicTyping) {
            if (isTypingFunction) {
              if (dynamicTyping(fields.length)) {
                value = this.castValue(value);
              }
            } else {
              value = this.castValue(value);
            }
          }

          fields.push(value);
          fStart = i + 1;
        }
      }

      // Skip empty lines if configured (optimized)
      if (skipEmptyLines === "greedy") {
        let isEmpty = true;
        for (let k = 0; k < fields.length; k++) {
          if (fields[k].trim() !== "") {
            isEmpty = false;
            break;
          }
        }
        if (isEmpty) {
          rowStart = rowEnd + newLen;
          continue;
        }
      } else if (skipEmptyLines && fields.length === 1 && fields[0].length === 0) {
        rowStart = rowEnd + newLen;
        continue;
      }

      // Handle step callback
      if (step) {
        throw new Error("Step callback is not supported in direct parser");
      } else {
        data.push(fields);
      }

      processedRows++;

      // Handle preview limit
      if (preview && processedRows >= preview) {
        meta.truncated = true;
        break;
      }

      // Move to next row
      rowStart = rowEnd + newLen;
    }

    // Handle header row if configured
    if (header && data.length > 0) {
      const headerRow = data.shift();
      if (headerRow) {
        meta.fields = headerRow.map((field: string, index: number) => {
          if (this.config.transformHeader) {
            return this.config.transformHeader(field, index);
          }
          return field;
        });
      }
    }

    // Set final cursor position
    meta.cursor = rowStart;

    return { data, errors, meta };
  }

  /**
   * Cast string value to appropriate type (matches legacy behavior)
   */
  private castValue(value: string): any {
    if (value === "") return value;

    // Try boolean first
    if (value === "true") return true;
    if (value === "false") return false;

    // Try number
    if (/^\s*-?(\d+\.?|\.\d+|\d+\.\d+)([eE][-+]?\d+)?\s*$/.test(value)) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        // Check for safe integer range
        const MAX_SAFE_FLOAT = 2 ** 53;
        const MIN_SAFE_FLOAT = -MAX_SAFE_FLOAT;
        if (num >= MIN_SAFE_FLOAT && num <= MAX_SAFE_FLOAT) {
          return num;
        }
      }
    }

    return value;
  }

  /**
   * Abort parsing
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Check if parser is aborted
   */
  isAborted(): boolean {
    return this.aborted;
  }
}
