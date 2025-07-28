import { CONSTANTS } from "../constants/index.js";
import type {
  PapaParseConfig,
  PapaParseError,
  PapaParseParser,
  PapaParseResult,
} from "../types/index.js";
import { copy, escapeRegExp, isFunction } from "../utils/index.js";
import { Parser } from "./parser.js";

/**
 * Parser Handle state for coordination and control
 */
interface ParserHandleState {
  stepCounter: number;
  rowCounter: number;
  paused: boolean;
  aborted: boolean;
  delimiterError: boolean;
  fields: string[];
  results: PapaParseResult;
  input: string;
  parser: Parser | null;
}

/**
 * High-level parser orchestration and configuration
 *
 * Provides the main interface for CSV parsing with:
 * - Delimiter auto-detection
 * - Line ending detection
 * - Header processing coordination
 * - Parse/pause/resume/abort controls
 * - Result processing and transformation
 *
 * Based on legacy PapaParse ParserHandle lines 1027-1406
 */
export class ParserHandle implements PapaParseParser {
  private config: PapaParseConfig;
  private state: ParserHandleState;

  // Constants for float validation (legacy reference: lines 1031-1034)
  private static readonly MAX_FLOAT = 2 ** 53;
  private static readonly MIN_FLOAT = -ParserHandle.MAX_FLOAT;
  private static readonly FLOAT =
    /^\s*-?(\d+\.?|\.\d+|\d+\.\d+)([eE][-+]?\d+)?\s*$/;
  private static readonly ISO_DATE =
    /^((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)))$/;

  // Reference to streamer for pause/resume functionality
  public streamer: any = null;

  constructor(config: PapaParseConfig) {
    this.config = this.processConfig(config);
    this.state = this.createInitialState();
    this.setupStepFunction();
  }

  /**
   * Parse input with optional streaming parameters
   * Legacy reference: lines 1083-1117
   */
  parse(input: string, baseIndex = 0, ignoreLastRow = false): PapaParseResult {
    // Auto-detect line endings if not specified
    const quoteChar = this.config.quoteChar || '"';
    if (!this.config.newline) {
      const detectedNewline = this.guessLineEndings(input, quoteChar);
      this.config.newline = detectedNewline as "\r" | "\n" | "\r\n";
    }

    // Auto-detect delimiter if not specified
    this.state.delimiterError = false;
    if (!this.config.delimiter) {
      const delimGuess = this.guessDelimiter(input);
      if (delimGuess.successful) {
        this.config.delimiter = delimGuess.bestDelimiter;
      } else {
        this.state.delimiterError = true;
        this.config.delimiter = CONSTANTS.DefaultDelimiter;
      }
      this.state.results.meta.delimiter = this.config.delimiter;
    } else if (isFunction(this.config.delimiter)) {
      this.config.delimiter = this.config.delimiter(input);
      this.state.results.meta.delimiter = this.config.delimiter;
    }

    // Prepare parser configuration
    const parserConfig = copy(this.config);
    if (this.config.preview && this.config.header) {
      parserConfig.preview++; // Compensate for header row
    }

    // Create parser and parse input
    this.state.input = input;
    this.state.parser = new Parser(parserConfig);
    this.state.results = this.state.parser.parse(
      input,
      baseIndex,
      ignoreLastRow,
    );

    this.processResults();

    return this.state.paused
      ? {
          data: [],
          errors: [],
          meta: {
            delimiter: this.config.delimiter || ",",
            linebreak: this.config.newline || "\n",
            aborted: false,
            truncated: false,
            cursor: 0,
            paused: true,
          },
        }
      : this.state.results || {
          data: [],
          errors: [],
          meta: {
            delimiter: this.config.delimiter || ",",
            linebreak: this.config.newline || "\n",
            aborted: false,
            truncated: false,
            cursor: 0,
            paused: false,
          },
        };
  }

  /**
   * Check if parser is paused
   * Legacy reference: lines 1119-1122
   */
  paused(): boolean {
    return this.state.paused;
  }

  /**
   * Pause parsing
   * Legacy reference: lines 1124-1132
   */
  pause(): void {
    this.state.paused = true;
    if (this.state.parser) {
      this.state.parser.abort();
    }

    // Handle chunk-based vs string-based parsing
    this.state.input = isFunction(this.config.chunk)
      ? ""
      : this.state.input.substring(this.state.parser?.getCharIndex() || 0);
  }

  /**
   * Resume parsing
   * Legacy reference: lines 1134-1144
   */
  resume(): void {
    if (this.streamer?._halted) {
      this.state.paused = false;
      this.streamer.parseChunk(this.state.input, true);
    } else {
      // Wait for streaming to halt before resuming
      setTimeout(() => this.resume(), 3);
    }
  }

  /**
   * Check if parser is aborted
   * Legacy reference: lines 1146-1149
   */
  aborted(): boolean {
    return this.state.aborted;
  }

  /**
   * Abort parsing
   * Legacy reference: lines 1151-1159
   */
  abort(): void {
    this.state.aborted = true;
    if (this.state.parser) {
      this.state.parser.abort();
    }
    this.state.results.meta.aborted = true;

    if (isFunction(this.config.complete)) {
      this.config.complete(this.state.results);
    }
    this.state.input = "";
  }

  /**
   * Get current character index
   */
  getCharIndex(): number {
    return this.state.parser?.getCharIndex() || 0;
  }

  /**
   * Guess line endings from input sample
   * Legacy reference: lines 1161-1185
   */
  guessLineEndings(input: string, quoteChar: string): string {
    // Limit analysis to first 1MB for performance
    input = input.substring(0, 1024 * 1024);

    // Remove quoted content to avoid false detection
    const re = new RegExp(
      escapeRegExp(quoteChar) + "([^]*?)" + escapeRegExp(quoteChar),
      "gm",
    );
    input = input.replace(re, "");

    const r = input.split("\r");
    const n = input.split("\n");

    // Check if \n appears first
    const nAppearsFirst = n.length > 1 && n[0].length < r[0].length;

    if (r.length === 1 || nAppearsFirst) {
      return "\n";
    }

    // Count \r\n combinations
    let numWithN = 0;
    for (let i = 0; i < r.length; i++) {
      if (r[i][0] === "\n") {
        numWithN++;
      }
    }

    return numWithN >= r.length / 2 ? "\r\n" : "\r";
  }

  /**
   * Create initial parser handle state
   */
  private createInitialState(): ParserHandleState {
    return {
      stepCounter: 0,
      rowCounter: 0,
      paused: false,
      aborted: false,
      delimiterError: false,
      fields: [],
      results: {
        data: [],
        errors: [],
        meta: {
          delimiter: ",",
          linebreak: "\n",
          aborted: false,
          truncated: false,
          cursor: 0,
        },
      },
      input: "",
      parser: null,
    };
  }

  /**
   * Process configuration and set defaults
   */
  private processConfig(config: PapaParseConfig): PapaParseConfig {
    const processed = copy(config);

    // Set default values
    if (processed.delimiter === undefined) processed.delimiter = "";
    if (processed.quoteChar === undefined) processed.quoteChar = '"';
    if (processed.header === undefined) processed.header = false;
    if (processed.dynamicTyping === undefined) processed.dynamicTyping = false;

    return processed;
  }

  /**
   * Setup step function wrapper for header processing
   * Legacy reference: lines 1050-1076
   */
  private setupStepFunction(): void {
    if (!isFunction(this.config.step)) return;

    const userStep = this.config.step;
    this.config.step = (results: PapaParseResult) => {
      this.state.results = results;

      if (this.needsHeaderRow()) {
        this.processResults();
      } else {
        // Call user's step function after header row
        this.processResults();

        // Check if row actually has data
        if (this.state.results.data.length === 0) {
          return;
        }

        this.state.stepCounter += results.data.length;
        if (
          this.config.preview &&
          this.state.stepCounter > this.config.preview
        ) {
          this.state.parser?.abort();
        } else {
          // Extract single row for step callback
          const singleRowResult = {
            ...this.state.results,
            data: this.state.results.data[0],
          };
          userStep(singleRowResult, this);
        }
      }
    };
  }

  /**
   * Check if we need to process header row
   */
  private needsHeaderRow(): boolean {
    return !!this.config.header && this.state.fields.length === 0;
  }

  /**
   * Process parsing results with transformations and validation
   * Legacy reference: lines 1201-1338
   */
  private processResults(): void {
    if (!this.state.results || !this.state.results.data) return;

    // Process headers if needed
    if (this.needsHeaderRow() && this.state.results.data.length > 0) {
      this.state.fields = this.state.results.data[0].map((field: any) =>
        String(field),
      );
      this.removeRow(0);
    }

    // Filter empty lines
    if (this.config.skipEmptyLines) {
      this.filterEmptyLines();
    }

    // Apply dynamic typing
    if (this.config.dynamicTyping) {
      this.applyDynamicTyping();
    }

    // Transform data to objects if headers present
    if (this.config.header && this.state.fields.length > 0) {
      this.transformToObjects();
    }

    // Add delimiter error if occurred
    if (this.state.delimiterError) {
      this.addDelimiterError();
    }
  }

  /**
   * Remove row at specified index
   */
  private removeRow(index: number): void {
    this.state.results.data.splice(index, 1);
  }

  /**
   * Filter empty lines based on configuration
   * Legacy reference: lines 1187-1189
   */
  private filterEmptyLines(): void {
    this.state.results.data = this.state.results.data.filter((row: any[]) => {
      return !this.testEmptyLine(row);
    });
  }

  /**
   * Test if line is empty based on skipEmptyLines setting
   */
  private testEmptyLine(row: any[]): boolean {
    return this.config.skipEmptyLines === "greedy"
      ? row.join("").trim() === ""
      : row.length === 1 && row[0].length === 0;
  }

  /**
   * Apply dynamic typing to all data
   */
  private applyDynamicTyping(): void {
    for (let i = 0; i < this.state.results.data.length; i++) {
      const row = this.state.results.data[i];
      for (let j = 0; j < row.length; j++) {
        row[j] = this.applyDynamicTypingToField(row[j], j);
      }
    }
  }

  /**
   * Apply dynamic typing to single field
   */
  private applyDynamicTypingToField(value: any, fieldIndex: number): any {
    if (typeof value !== "string") return value;

    // Check configuration for this field
    if (typeof this.config.dynamicTyping === "object") {
      if (
        typeof fieldIndex === "number" &&
        this.config.dynamicTyping[fieldIndex] === false
      ) {
        return value;
      }
      if (
        typeof fieldIndex === "string" &&
        this.config.dynamicTyping[fieldIndex] === false
      ) {
        return value;
      }
    } else if (typeof this.config.dynamicTyping === "function") {
      if (!this.config.dynamicTyping(fieldIndex)) {
        return value;
      }
    }

    return this.parseTypedValue(value);
  }

  /**
   * Parse string value to appropriate type
   * Legacy reference: lines 1192-1277
   */
  private parseTypedValue(value: string): any {
    // Handle empty and whitespace
    if (value === "") return value;
    if (value.trim() === "") return value;

    // Boolean values
    if (value === "true") return true;
    if (value === "false") return false;

    // Null values
    if (value === "null" || value === "NULL") return null;

    // Number values
    if (this.testFloat(value)) {
      return parseFloat(value);
    }

    // ISO date values
    if (ParserHandle.ISO_DATE.test(value)) {
      return new Date(value);
    }

    // Return original string
    return value;
  }

  /**
   * Test if string is a valid float
   * Legacy reference: lines 1191-1199
   */
  private testFloat(value: string): boolean {
    if (ParserHandle.FLOAT.test(value)) {
      const floatValue = parseFloat(value);
      if (
        floatValue > ParserHandle.MIN_FLOAT &&
        floatValue < ParserHandle.MAX_FLOAT
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Transform array data to objects using headers
   */
  private transformToObjects(): void {
    for (let i = 0; i < this.state.results.data.length; i++) {
      const row = this.state.results.data[i];
      const obj: any = {};

      for (let j = 0; j < this.state.fields.length && j < row.length; j++) {
        obj[this.state.fields[j]] = row[j];
      }

      this.state.results.data[i] = obj;
    }
  }

  /**
   * Add delimiter detection error
   */
  private addDelimiterError(): void {
    this.state.results.errors.push({
      type: "Delimiter",
      code: "UndetectableDelimiter",
      message: "Unable to auto-detect delimiting character; defaulted to comma",
      row: 0,
      index: 0,
    });
  }

  /**
   * Guess delimiter from input sample
   * Placeholder for Phase 3 heuristics implementation
   */
  private guessDelimiter(input: string): {
    successful: boolean;
    bestDelimiter: string;
  } {
    // Basic implementation - will be enhanced in Phase 3
    const delimiters = this.config.delimitersToGuess || [
      ",",
      "\t",
      "|",
      ";",
      CONSTANTS.RECORD_SEP,
      CONSTANTS.UNIT_SEP,
    ];

    // For now, just return comma as default
    // Real implementation will be in src/heuristics/guess-delimiter.ts
    return {
      successful: true,
      bestDelimiter: ",",
    };
  }
}

/**
 * Create parser handle instance
 */
export function createParserHandle(config: PapaParseConfig): ParserHandle {
  return new ParserHandle(config);
}
