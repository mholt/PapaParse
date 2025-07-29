# Build Setup

This project uses [tsup](https://tsup.egoist.dev/) to build PapaParse in multiple formats.

## Build Formats

The library is built in three formats:

1. **CommonJS (CJS)** - For Node.js environments using `require()`
2. **ES Modules (ESM)** - For modern JavaScript environments using `import`
3. **IIFE** - For browser environments via `<script>` tags (creates global `Papa` variable)

## Build Commands

```bash
# Standard build (non-minified)
bun run build:tsup

# Minified build
bun run build:tsup:minified

# Watch mode for development
bun run build:tsup:watch
```

## Output Files

All builds are output to the `dist/` directory:

- `papaparse.js` - CommonJS build
- `papaparse.mjs` - ES Module build
- `papaparse.iife.js` - Browser IIFE build (global `Papa` variable)
- `papaparse.browser.js` - CommonJS browser entry
- `papaparse.browser.mjs` - ES Module browser entry
- `papaparse.browser.iife.js` - Browser IIFE build (alternative entry)

Minified versions add `.min` before the extension (e.g., `papaparse.min.js`).

## Usage

### Node.js (CommonJS)
```javascript
const Papa = require('papaparse');
```

### ES Modules
```javascript
import Papa from 'papaparse';
```

### Browser (Script Tag)
```html
<script src="path/to/papaparse.iife.js"></script>
<script>
  // Papa is now available as a global variable
  const result = Papa.parse(csvString);
</script>
```

## Package.json Configuration

The `package.json` is configured with proper exports for all environments:

```json
{
  "main": "./dist/papaparse.js",          // CommonJS
  "module": "./dist/papaparse.mjs",        // ES Module
  "browser": "./dist/papaparse.browser.iife.js", // Browser
  "types": "./dist/papaparse.d.ts",        // TypeScript types
  "exports": {
    ".": {
      "types": "./dist/papaparse.d.ts",
      "browser": "./dist/papaparse.browser.iife.js",
      "import": "./dist/papaparse.mjs",
      "require": "./dist/papaparse.js"
    }
  }
}
```

## Testing

The V6 tests are configured to use the IIFE build:

```bash
# Browser tests with IIFE build
bun run test-browser:v6

# Headless browser tests with IIFE build
bun run test-mocha-headless-chrome:v6
```

These tests will automatically use the `dist/papaparse.iife.js` file, which exposes Papa as a global variable.
