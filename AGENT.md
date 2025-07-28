# PapaParse Agent Guide

ALWAYS REFERENCE V6_REFACTOR.md before beginning refactor work.
ALWAYS UPDATE V6_REFACTOR.md with any progress you've made.
ALWAYS RUN `bun run format:fix` after your work

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

## Code Style (from biome.json)
- **Indentation**: Spaces only (2 spaces)
- **Quotes**: Double quotes preferred (`"quoteStyle": "double"`)
- **Linting**: Biome with recommended rules enabled
- **Formatting**: Uses Biome formatter
- **Scope**: Currently only applied to `src/**/*.ts` files
- **Format**: Run `bun run format` to check, `bun run format:fix` to auto-fix
