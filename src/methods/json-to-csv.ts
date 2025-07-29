/**
 * JSON to CSV Serialization - Main unparsing function with configuration handling
 *
 * This module implements the JsonToCsv function from the legacy codebase,
 * providing CSV serialization with quote handling, formula escape prevention,
 * and comprehensive configuration support.
 * Based on legacy lines 264-484.
 */

import type { PapaUnparseConfig, PapaUnparseData } from "../types";
import { escapeRegExp } from "../utils";
import { CONSTANTS } from "../constants";

/**
 * Main JSON to CSV serialization function
 *
 * Converts JavaScript objects/arrays to CSV string format with full configuration
 * support including quote handling, formula escape, and delimiter customization.
 * Maintains exact legacy behavior and API compatibility.
 *
 * @param input - Input data (array of arrays, array of objects, or object with data/fields)
 * @param config - Serialization configuration options
 * @returns CSV string representation of the input data
 */
export function JsonToCsv<T = any>(input: PapaUnparseData<T>, config?: PapaUnparseConfig): string {
  // Internal configuration variables - default values from legacy
  let _quotes: boolean | boolean[] | ((value: any, columnIndex: number) => boolean) = false;
  let _writeHeader = true;
  let _delimiter = ",";
  let _newline = "\r\n";
  let _quoteChar = '"';
  let _escapedQuote = _quoteChar + _quoteChar;
  let _skipEmptyLines: boolean | "greedy" = false;
  let _columns: string[] | null = null;
  let _escapeFormulae: boolean | RegExp = false;

  // Process configuration
  unpackConfig();

  // Create quote character regex for escaping
  const quoteCharRegex = new RegExp(escapeRegExp(_quoteChar), "g");

  // Handle string input by parsing as JSON
  let processedInput = input;
  if (typeof processedInput === "string") {
    processedInput = JSON.parse(processedInput);
  }

  // Main input type detection and routing - matches legacy lines 302-334
  if (Array.isArray(processedInput)) {
    // Array of arrays or empty array
    if (!processedInput.length || Array.isArray(processedInput[0])) {
      return serialize(null, processedInput as any[][], _skipEmptyLines);
    }
    // Array of objects
    else if (typeof processedInput[0] === "object" && processedInput[0] !== null) {
      return serialize(_columns || Object.keys(processedInput[0]), processedInput as any[], _skipEmptyLines);
    }
  }
  // Object with data property
  else if (typeof processedInput === "object" && processedInput !== null) {
    const inputObj = processedInput as any;

    // Parse data string if needed
    if (typeof inputObj.data === "string") {
      inputObj.data = JSON.parse(inputObj.data);
    }

    if (Array.isArray(inputObj.data)) {
      // Determine fields from various sources
      if (!inputObj.fields) {
        inputObj.fields = (inputObj.meta && inputObj.meta.fields) || _columns;
      }

      if (!inputObj.fields) {
        inputObj.fields = Array.isArray(inputObj.data[0])
          ? inputObj.fields
          : typeof inputObj.data[0] === "object"
            ? Object.keys(inputObj.data[0])
            : [];
      }

      // Handle simple array input like [1,2,3] or ['asdf']
      if (!Array.isArray(inputObj.data[0]) && typeof inputObj.data[0] !== "object") {
        inputObj.data = [inputObj.data];
      }
    }

    return serialize(inputObj.fields || [], inputObj.data || [], _skipEmptyLines);
  }

  // Default case - should not reach here with valid input
  throw new Error("Unable to serialize unrecognized input");

  /**
   * Unpacks and validates configuration options
   * Matches legacy unpackConfig function exactly (lines 337-382)
   */
  function unpackConfig(): void {
    if (typeof config !== "object" || config === null) {
      return;
    }

    // Delimiter validation - must not contain bad delimiters
    if (
      typeof config.delimiter === "string" &&
      !CONSTANTS.BAD_DELIMITERS.some((badDelim) => config.delimiter!.indexOf(badDelim) !== -1)
    ) {
      _delimiter = config.delimiter;
    }

    // Quotes configuration
    if (typeof config.quotes === "boolean" || typeof config.quotes === "function" || Array.isArray(config.quotes)) {
      _quotes = config.quotes;
    }

    // Skip empty lines configuration
    if (typeof config.skipEmptyLines === "boolean" || typeof config.skipEmptyLines === "string") {
      _skipEmptyLines = config.skipEmptyLines;
    }

    // Newline configuration
    if (typeof config.newline === "string") {
      _newline = config.newline;
    }

    // Quote character configuration
    if (typeof config.quoteChar === "string") {
      _quoteChar = config.quoteChar;
    }

    // Header configuration
    if (typeof config.header === "boolean") {
      _writeHeader = config.header;
    }

    // Columns configuration
    if (Array.isArray(config.columns)) {
      if (config.columns.length === 0) {
        throw new Error("Option columns is empty");
      }
      _columns = config.columns;
    }

    // Escape character configuration
    if (config.escapeChar !== undefined) {
      _escapedQuote = config.escapeChar + _quoteChar;
    }

    // Formula escape configuration
    if (config.escapeFormulae instanceof RegExp) {
      _escapeFormulae = config.escapeFormulae;
    } else if (typeof config.escapeFormulae === "boolean" && config.escapeFormulae) {
      _escapeFormulae = /^[=+\-@\t\r].*$/;
    }
  }

  /**
   * The main serialization function that converts data to CSV string
   * Matches legacy serialize function exactly (lines 385-445)
   */
  function serialize(fields: string[] | null, data: any[][], skipEmptyLines: boolean | "greedy"): string {
    let csv = "";

    // Parse fields if string
    if (typeof fields === "string") {
      fields = JSON.parse(fields);
    }
    // Parse data if string
    if (typeof data === "string") {
      data = JSON.parse(data);
    }

    const hasHeader = Array.isArray(fields) && fields.length > 0;
    const dataKeyedByField = !Array.isArray(data[0]);

    // Write header row if present and enabled
    if (hasHeader && _writeHeader) {
      for (let i = 0; i < fields!.length; i++) {
        if (i > 0) {
          csv += _delimiter;
        }
        csv += safe(fields![i], i);
      }
      if (data.length > 0) {
        csv += _newline;
      }
    }

    // Write data rows
    for (let row = 0; row < data.length; row++) {
      const maxCol = hasHeader ? fields!.length : data[row].length;

      let emptyLine = false;
      const nullLine = hasHeader ? Object.keys(data[row]).length === 0 : data[row].length === 0;

      // Empty line detection for non-header mode
      if (skipEmptyLines && !hasHeader) {
        emptyLine =
          skipEmptyLines === "greedy"
            ? data[row].join("").trim() === ""
            : data[row].length === 1 && data[row][0].length === 0;
      }

      // Empty line detection for header mode (greedy)
      if (skipEmptyLines === "greedy" && hasHeader) {
        const line = [];
        for (let c = 0; c < maxCol; c++) {
          const cx = dataKeyedByField ? fields![c] : c;
          line.push((data[row] as any)[cx]);
        }
        emptyLine = line.join("").trim() === "";
      }

      // Write row if not empty
      if (!emptyLine) {
        for (let col = 0; col < maxCol; col++) {
          if (col > 0 && !nullLine) {
            csv += _delimiter;
          }
          const colIdx = hasHeader && dataKeyedByField ? fields![col] : col;
          csv += safe((data[row] as any)[colIdx], col);
        }
        // Add newline if not last row and conditions are met
        if (row < data.length - 1 && (!skipEmptyLines || (maxCol > 0 && !nullLine))) {
          csv += _newline;
        }
      }
    }

    return csv;
  }

  /**
   * Makes a value safe for CSV insertion by adding quotes if needed
   * Matches legacy safe function exactly (lines 448-475)
   */
  function safe(str: any, col: number): string {
    if (typeof str === "undefined" || str === null) {
      return "";
    }

    // Handle Date objects
    if (str.constructor === Date) {
      return JSON.stringify(str).slice(1, 25);
    }

    let needsQuotes = false;

    // Formula escape prevention
    if (_escapeFormulae && typeof str === "string" && _escapeFormulae instanceof RegExp && _escapeFormulae.test(str)) {
      str = "'" + str;
      needsQuotes = true;
    }

    // Escape existing quote characters
    const escapedQuoteStr = str.toString().replace(quoteCharRegex, _escapedQuote);

    // Determine if quotes are needed
    needsQuotes =
      needsQuotes ||
      _quotes === true ||
      (typeof _quotes === "function" && _quotes(str, col)) ||
      (Array.isArray(_quotes) && _quotes[col]) ||
      hasAny(escapedQuoteStr, CONSTANTS.BAD_DELIMITERS) ||
      escapedQuoteStr.indexOf(_delimiter) > -1 ||
      escapedQuoteStr.charAt(0) === " " ||
      escapedQuoteStr.charAt(escapedQuoteStr.length - 1) === " ";

    return needsQuotes ? _quoteChar + escapedQuoteStr + _quoteChar : escapedQuoteStr;
  }

  /**
   * Checks if a string contains any of the specified substrings
   * Matches legacy hasAny function exactly (lines 477-483)
   */
  function hasAny(str: string, substrings: readonly string[]): boolean {
    for (let i = 0; i < substrings.length; i++) {
      if (str.indexOf(substrings[i]) > -1) {
        return true;
      }
    }
    return false;
  }
}
