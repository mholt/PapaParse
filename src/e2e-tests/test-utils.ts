import { expect } from "bun:test";
import Papa from "../index.js";

export interface TestCase {
  description: string;
  input: string;
  config?: Papa.ParseConfig;
  expected: {
    data: any[][];
    errors: Papa.ParseError[];
    meta?: Partial<Papa.ParseMeta>;
  };
  notes?: string;
  disabled?: boolean;
}

export interface AsyncTestCase {
  description: string;
  input: string | File;
  config?: Papa.ParseConfig;
  expected: {
    data: any[][];
    errors: Papa.ParseError[];
    meta?: Partial<Papa.ParseMeta>;
  };
  notes?: string;
  disabled?: boolean;
  timeout?: number;
}

export interface UnparseTestCase {
  description: string;
  input: any[][] | any[] | { fields?: string[]; data?: any[][] };
  config?: Papa.UnparseConfig;
  expected: string;
  notes?: string;
  disabled?: boolean;
}

export interface CustomTestCase {
  description: string;
  expected: any;
  run: (callback: (actual: any) => void) => void;
  notes?: string;
  disabled?: boolean;
  timeout?: number;
}

/**
 * Assert that Papa.parse result matches expected output
 */
export function assertParseResult(actual: Papa.ParseResult<any>, expected: TestCase["expected"]) {
  // Check errors first
  expect(actual.errors).toEqual(expected.errors);

  // Check data
  expect(actual.data).toEqual(expected.data);

  // Check meta if specified in expected
  if (expected.meta) {
    // Only check the properties specified in expected.meta
    for (const [key, value] of Object.entries(expected.meta)) {
      expect(actual.meta[key]).toEqual(value);
    }
  }
}

/**
 * Run a synchronous Papa.parse test
 */
export function runParseTest(testCase: TestCase) {
  const actual = Papa.parse(testCase.input, testCase.config);
  assertParseResult(actual, testCase.expected);
}

/**
 * Run an asynchronous Papa.parse test (returns promise)
 */
export function runAsyncParseTest(testCase: AsyncTestCase): Promise<void> {
  return new Promise((resolve, reject) => {
    const config = { ...testCase.config };

    config.complete = (actual: Papa.ParseResult<any>) => {
      try {
        assertParseResult(actual, testCase.expected);
        resolve();
      } catch (error) {
        reject(error);
      }
    };

    config.error = (error: Error) => {
      reject(error);
    };

    Papa.parse(testCase.input, config);
  });
}

/**
 * Run a Papa.unparse test
 */
export function runUnparseTest(testCase: UnparseTestCase) {
  const actual = Papa.unparse(testCase.input, testCase.config);
  expect(actual).toBe(testCase.expected);
}

/**
 * Run a custom test with callback
 */
export function runCustomTest(testCase: CustomTestCase): Promise<void> {
  return new Promise((resolve, reject) => {
    testCase.run((actual: any) => {
      try {
        expect(actual).toEqual(testCase.expected);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Create a test file helper that tests for specific error conditions
 */
export function expectParseError(input: string, config: Papa.ParseConfig, expectedErrorCode: string) {
  const result = Papa.parse(input, config);
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.errors.some((err) => err.code === expectedErrorCode)).toBe(true);
}

/**
 * Create test data helper for File objects
 */
export function createTestFile(content: string, filename = "test.csv"): File {
  const file = new File([content], filename, { type: "text/csv" });
  // Add the text content as a property for our mock FileReaderSync
  (file as any).textContent = content;
  return file;
}
