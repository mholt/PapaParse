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

  constructor(private config: PapaParseConfig) {}

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
      cursor: input.length,
    };

    if (!input) {
      return { data: [], errors: [], meta };
    }

    // Optimized streaming approach for maximum performance
    // Avoids creating large intermediate arrays while maintaining speed
    const inputLen = input.length;
    const data: any[][] = [];
    const errors: PapaParseError[] = [];
    
    let processedRows = 0;
    let startPos = 0;

    // Stream through input without creating full rows array upfront
    while (startPos < inputLen && !this.aborted) {
      // Find next newline efficiently
      let endPos = input.indexOf(newline, startPos);
      if (endPos === -1) {
        endPos = inputLen; // Last line without newline
      }

      const row = input.substring(startPos, endPos);

      // Skip comment lines
      if (comments && row.substring(0, commentsLen) === comments) {
        startPos = endPos + newline.length;
        continue;
      }

      // Parse row into fields - optimized field processing
      const fields = row.split(delimiter);
      const fieldsLen = fields.length;

      // Apply transforms and dynamic typing only if needed
      if (transform || dynamicTyping) {
        const isTypingFunction = typeof dynamicTyping === "function";
        
        // Optimize for the common case where these are disabled
        if (!transform && !dynamicTyping) {
          // Skip field processing entirely
        } else {
          for (let j = 0; j < fieldsLen; j++) {
            let value = fields[j];

            // Apply transform function
            if (transform) {
              value = transform(value, j);
            }

            // Apply dynamic typing (optimized)
            if (dynamicTyping) {
              if (isTypingFunction) {
                if (dynamicTyping(j)) {
                  value = this.castValue(value);
                }
              } else {
                value = this.castValue(value);
              }
            }

            fields[j] = value;
          }
        }
      }

      // Skip empty lines if configured
      if (skipEmptyLines) {
        if (skipEmptyLines === "greedy") {
          if (fields.join("").trim() === "") {
            continue;
          }
        } else {
          if (fieldsLen === 1 && fields[0].length === 0) {
            continue;
          }
        }
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
      startPos = endPos + newline.length;
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
