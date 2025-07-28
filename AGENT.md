# PapaParse Agent Guide

ALWAYS REFERENCE V6_REFACTOR.md before beginning refactor work.
ALWAYS UPDATE V6_REFACTOR.md with any progress you've made.

## Commands
- **Test**: `bun test` (all), `bun run test-node` (node only), `bun run test-mocha-headless-chrome` (headless browser)
- **Lint**: `bun run lint`
- **Build**: `bun run build` or `grunt build` (creates minified version)
- **Development server**: `bun tests/test.js` (for browser testing)
- **Modern Development**: Uses bun for modern TypeScript development

## Architecture
**REFACTOR IN PROGRESS**: Moving from legacy single-file to modern TypeScript structure
- **Legacy**: `legacy/papaparse.js` - Original single-file CSV parser (still main entry point)
- **Modern**: `src/index.ts` - New TypeScript implementation (work in progress)
- **Tests**: Uses Mocha + Chai. Core tests in `tests/test-cases.js`, Node streaming tests in `tests/node-tests.js`
- **Build**: Grunt uglifies legacy → `papaparse.min.js`
- **No dependencies**: Library remains completely standalone

## Code Style (from .eslintrc.js)
- **Indentation**: Tabs only (`"indent": ["error", "tab"]`)
- **Semicolons**: Required (`"semi": "error"`)
- **Naming**: camelCase for variables, no property enforcement (`"camelcase": ["error", {"properties": "never"}]`)
- **Spacing**: No space before function parens (`"space-before-function-paren": ["error", "never"]`)
- **Line endings**: Unix style (`"linebreak-style": ["error", "unix"]`)
- **Quotes**: No enforcement (flexible)
- **Variables**: `var` allowed, `prefer-const` for new code
