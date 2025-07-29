# PapaParse Agent Guide

**V6 MIGRATION STATUS**: ✅ Core implementation complete! Modern TypeScript architecture is ready for production use.
- 100% API compatibility maintained
- All existing tests pass without modification
- Modular architecture with tree-shakable plugins
- Full TypeScript support with proper type definitions

ALWAYS REFERENCE V6_REFACTOR.md for detailed implementation status and remaining tasks.
ALWAYS UPDATE V6_REFACTOR.md with any progress you've made.
ALWAYS RUN `bun run format:fix` after your work

## Commands

### Testing
- **Test All (Legacy)**: `bun test`
- **Test Node (Legacy)**: `bun run test-node`
- **Test All (V6)**: `bun test:v6`
- **Test Node (V6)**: `bun run test-node:v6`
- **Test Browser (V6)**: `bun run test-browser:v6`
- **Test Headless (V6)**: `bun run test-mocha-headless-chrome:v6`
- **CI Tests**: `bun run ci:all` (complete CI test suite)
- **Development server**: `bun tests/test.js` (for browser testing)

### Building
- **Build Legacy**: `bun run build` or `grunt build`
- **Build V6**: `bun run build:tsup` (production build)
- **Build Watch**: `bun run build:tsup:watch` (development)
- **Build Minified**: `bun run build:tsup:minified`

### Code Quality
- **Lint**: `bun run lint`
- **Format Check**: `bun run check`
- **Format Fix**: `bun run check:fix`

### CI/Testing Infrastructure
- **Foundation Tests**: `bun run ci:foundation` ✅ PASSING
- **Performance Benchmark**: `bun run ci:benchmark`
- **API Compatibility**: `bun run ci:api-test`
- **Snapshot Tests**: `bun run ci:snapshots:validate`

## Architecture

### V6 Modern TypeScript Implementation (Primary) ✅
- **Entry Points**:
  - Browser: `dist/papaparse.browser.iife.js`
  - Node CJS: `dist/papaparse.js`
  - Node ESM: `dist/papaparse.mjs`
  - Types: `dist/papaparse.d.ts`
- **Source**: `src/` - Modular TypeScript architecture
  - `core/` - Parsing engine (lexer, parser, errors)
  - `streamers/` - Various input stream handlers
  - `heuristics/` - Auto-detection algorithms
  - `workers/` - Web worker support
  - `plugins/` - Tree-shakable plugin system
- **Build**: Uses tsup for modern bundling

### Legacy Implementation (Deprecated)
- **Source**: `legacy/papaparse.js` - Original single-file implementation
- **Build**: Grunt uglifies to `papaparse.min.js`
- **Status**: Maintained for compatibility, will be phased out

### Testing
- **Framework**: Mocha + Chai
- **Core Tests**: `tests/test-cases.js`
- **Node Tests**: `tests/node-tests.js`
- **CI Infrastructure**: `src/ci/` - Performance, API, and snapshot testing

## Key Features
- **Zero Dependencies**: Library remains completely standalone
- **100% Backward Compatible**: Drop-in replacement for v5
- **Tree-Shakable**: Optional features like jQuery plugin can be excluded
- **TypeScript Native**: Full type safety and IntelliSense support
- **Performance Optimized**: Within 5% of legacy implementation speed

## Code Style (from biome.json)
- **Indentation**: Spaces only (2 spaces)
- **Quotes**: Double quotes preferred (`"quoteStyle": "double"`)
- **Linting**: Biome with recommended rules enabled
- **Formatting**: Uses Biome formatter
- **Scope**: Applied to `src/**/*.ts` files
- **Format**: Run `bun run check` to check, `bun run check:fix` to auto-fix

## Development Workflow
1. Check V6_REFACTOR.md for current status and remaining tasks
2. Make changes in `src/` directory (TypeScript)
3. Run `bun run build:tsup:watch` for development
4. Test with `bun run test:v6`
5. Format code with `bun run check:fix`
6. Update V6_REFACTOR.md with progress
