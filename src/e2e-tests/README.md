# E2E Tests for PapaParse V6

This directory contains comprehensive end-to-end tests for the new V6 implementation of PapaParse. These tests were created to systematically verify the new TypeScript implementation maintains 100% compatibility with the legacy version.

## Test Organization

The tests are organized by functionality rather than using the original array-iteration approach from the legacy tests:

### Core Test Files

- **`core-parser.test.ts`** - Basic CSV parsing functionality
  - Quoted fields, escaped quotes, delimiter handling
  - Error cases like missing quotes, malformed quotes
  - Based on `CORE_PARSER_TESTS` from legacy test suite

- **`parse-features.test.ts`** - Advanced parsing features  
  - Comments, dynamic typing, transforms
  - Headers, previews, empty line handling
  - Custom delimiters, escape characters, encoding
  - Based on `PARSE_TESTS` from legacy test suite

- **`parse-async.test.ts`** - Asynchronous parsing
  - File parsing, worker threads, streaming
  - Large file handling, chunked processing
  - Based on `PARSE_ASYNC_TESTS` from legacy test suite

- **`unparse.test.ts`** - CSV generation (JSON to CSV)
  - Array and object input formats
  - Custom delimiters, quotes, line endings
  - Header handling, data transformation
  - Based on `UNPARSE_TESTS` from legacy test suite

- **`custom-streaming.test.ts`** - Streaming and step-based parsing
  - Step callbacks, chunk processing
  - Pause/resume/abort functionality  
  - Based on `CUSTOM_TESTS` from legacy test suite

### Utilities

- **`test-utils.ts`** - Shared test utilities and helpers
  - Test case type definitions
  - Assertion helpers for parse results
  - Async test runners
  - File creation utilities

## Running Tests

### All E2E Tests
```bash
bun run test:e2e
```

### Watch Mode
```bash
bun run test:e2e:watch
```

### Specific Test File
```bash
bun test src/e2e-tests/core-parser.test.ts
```

### Single Test Case
```bash
bun test src/e2e-tests/core-parser.test.ts -t "should parse one row"
```

## Test Philosophy

### Individual Test Cases
Instead of the legacy approach of iterating through test arrays, each test case is written as an individual `it()` block. This provides several benefits:

- **Better debugging** - Failed tests are immediately identifiable
- **Clearer output** - Test names are descriptive and specific
- **Easier maintenance** - Individual tests can be modified without affecting others
- **Better IDE support** - Jump to specific tests, run individual tests

### Type Safety
All tests are written in TypeScript with proper type definitions for:
- Test case structures
- Papa parse configurations
- Expected results and error formats

### V6 Only Testing
These tests specifically target the new V6 implementation only. They import from `../index.js` which points to the new modular TypeScript implementation, not the legacy version.

## Test Coverage

The test suite covers:

✅ **Basic Parsing** - All fundamental CSV parsing scenarios  
✅ **Advanced Features** - Comments, transforms, dynamic typing  
✅ **Error Handling** - Malformed quotes, missing delimiters  
✅ **Async Operations** - Files, workers, streaming  
✅ **CSV Generation** - All unparse functionality  
✅ **Streaming** - Step callbacks, chunking, pause/resume  

## Adding New Tests

When adding new test cases:

1. Choose the appropriate test file based on functionality
2. Use the test utilities from `test-utils.ts`
3. Write individual `it()` blocks with descriptive names
4. Include proper type annotations
5. Add error cases where applicable

Example:
```typescript
it("should handle custom delimiter with special characters", () => {
  runParseTest({
    description: "Custom delimiter with special characters",
    input: "a|b|c\nd|e|f",
    config: { delimiter: "|" },
    expected: {
      data: [["a", "b", "c"], ["d", "e", "f"]],
      errors: []
    }
  });
});
```

## Migration from Legacy Tests

These tests are based on the original test cases from `tests/test-cases.js` but have been:

- Converted from JavaScript to TypeScript
- Reorganized by functionality
- Split into individual test cases
- Enhanced with better type safety
- Updated to use modern test utilities

The original test data and expected results are preserved to ensure compatibility.
