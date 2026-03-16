# V6 Browser Testing

This directory contains the V6 browser test setup that honors the `PAPA_ENTRY_POINT` environment variable.

## Files

- `test-v6.js` - Modified test server that dynamically replaces the PapaParse script path in tests.html based on the `PAPA_ENTRY_POINT` environment variable
- `test.js` - Original test server (always uses legacy/papaparse.js)

## Usage

### Build the V6 browser bundle
```bash
bun run build-browser:v6
```

### Run V6 browser tests
```bash
# Open in browser
bun run test-browser:v6

# Run headless with Chrome
bun run test-mocha-headless-chrome:v6
```

### Run with custom entry point
```bash
# Use a different entry point
PAPA_ENTRY_POINT=../path/to/custom/papa.js node tests/test-v6.js
```

## How it works

1. The `test-v6.js` file reads the `PAPA_ENTRY_POINT` environment variable (defaults to `../legacy/papaparse.js`)
2. It reads the original `tests.html` file
3. It replaces the PapaParse script path with the one from the environment variable
4. It serves the modified HTML when accessing `/tests/tests.html`
5. The tests run with the specified PapaParse implementation

## Default Entry Points

- **Legacy browser tests**: `../legacy/papaparse.js`
- **V6 browser tests**: `../dist/papaparse-v6.js`
- **V6 Node tests**: `../dist/cjs-entry.js`
