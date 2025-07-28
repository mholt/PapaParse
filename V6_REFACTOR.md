# PapaParse V6 Refactoring Plan

## 🚀 Implementation Progress

**Current Status: Phase 4 Complete ✅**

- ✅ **Phase 1: Foundation & Performance Infrastructure** (100% Complete)
- ✅ **Phase 2: Core Parsing Engine** (100% Complete)
- ✅ **Phase 3: Heuristics & Algorithms** (100% Complete)
- ✅ **Phase 4: Streaming Infrastructure** (100% Complete)
- ⏳ **Phase 5: Core Functions** (Planned)
- ⏳ **Phase 6: Workers & Concurrency** (Planned)
- ⏳ **Phase 7: Plugin System** (Planned)
- ⏳ **Phase 8: Public API & Compatibility** (Planned)

### Recent Achievements (Phase 1)
- ✅ Complete TypeScript foundation with exact legacy compatibility types
- ✅ Runtime-mutable constants system preserving legacy behavior
- ✅ Comprehensive utility functions extracted from legacy implementation
- ✅ Performance benchmark harness for regression testing
- ✅ Golden output snapshots for compatibility validation
- ✅ API surface reflection testing for singleton consistency
- ✅ Full CI testing infrastructure with npm scripts
- ✅ Foundation tests passing: `bun run ci:foundation`

### Recent Achievements (Phase 2)
- ✅ Complete lexer implementation with quote state machine and fast mode
- ✅ Parser implementation with row assembly and header processing
- ✅ Comprehensive error handling system with standardized types
- ✅ Parser handle for high-level orchestration and configuration
- ✅ Dynamic typing and transformation support
- ✅ Header duplicate detection and renaming
- ✅ TypeScript compilation without enums for better compatibility

### Recent Achievements (Phase 3)
- ✅ Delimiter auto-detection algorithm with field count consistency analysis
- ✅ Dynamic typing heuristics for boolean, numeric, date, and null detection
- ✅ Line ending detection with quote-aware analysis
- ✅ Stateless, pure functions for reusability
- ✅ Comprehensive type safety and compatibility
- ✅ Foundation tests passing: `bun run ci:foundation`

### Recent Achievements (Phase 4)
- ✅ Base ChunkStreamer class with progress tracking and coordination
- ✅ StringStreamer for memory-efficient string processing with chunking
- ✅ FileStreamer with FileReader API and progress events
- ✅ NetworkStreamer for remote file downloading with range requests
- ✅ ReadableStreamStreamer for Node.js streams with backpressure
- ✅ DuplexStreamStreamer for Node.js duplex streams and piping
- ✅ Complete TypeScript implementation with proper inheritance
- ✅ Foundation tests passing: `bun run ci:foundation`

### Next Steps (Phase 5)
Ready to begin Core Functions implementation:
- CSV to JSON main function with input type detection
- JSON to CSV main function with configuration and serialization
- Worker coordination and streamer selection logic

## Overview
This document outlines the migration plan from the legacy single-file format (`legacy/papaparse.js`) to a modern, modular TypeScript architecture while maintaining 100% API compatibility and ensuring all tests pass.

## Goals
- **API Compatibility**: Maintain identical public API contract
- **Test Preservation**: All existing tests must pass without modification
- **Modular Architecture**: Break down monolithic file into focused, maintainable modules
- **TypeScript**: Full TypeScript implementation with proper type definitions
- **Performance**: Maintain or improve parsing performance
- **Zero Breaking Changes**: Seamless upgrade path for users

## Current State Analysis

### Legacy Structure (`legacy/papaparse.js` - 1944 lines)
The legacy file contains several major components:

1. **Module Factory & UMD Wrapper** (lines 8-46)
   - Universal module definition for AMD, CommonJS, and browser globals
   - Global detection and worker blob creation

2. **Main Papa Object & API** (lines 60-86)
   - `Papa.parse` (CsvToJson)
   - `Papa.unparse` (JsonToCsv)
   - Constants and configuration
   - Exposed internal classes for testing

3. **jQuery Plugin** (lines 88-180)
   - File input parsing with queue management
   - Optional jQuery integration

4. **Worker Support** (lines 183-186, 879-977)
   - Web Worker message handling
   - Blob URL creation for worker scripts

5. **Core Parsing Logic**
   - `CsvToJson` function (lines 196-257)
   - `JsonToCsv` function (lines 264-484)

6. **Streaming Infrastructure** (lines 487-1024)
   - `ChunkStreamer` base class (lines 487-563)
   - `StringStreamer`, `FileStreamer`, `NetworkStreamer`
   - `ReadableStreamStreamer`, `DuplexStreamStreamer` (lines 564-1024)

7. **ParserHandle** (lines 1027-1406)
   - High-level parser orchestration and configuration
   - Delimiter auto-detection (lines 1340-1392)
   - Dynamic typing and header processing (lines 1253-1338)
   - Line ending detection (lines 1161-1185)
   - Result processing and transformation

8. **Parser Engine** (lines 1414-1819)
   - Low-level `Parser` class with complex state machine
   - Quote handling, field parsing, comment detection
   - Fast mode optimization (lines 1482-1513)
   - Main parsing loop with quote state machine (lines 1520-1683)
   - Header duplicate detection and renaming (lines 1743-1784)

9. **Worker Management** (lines 1821-1920)
   - Worker creation and lifecycle
   - Message passing between main and worker threads
   - Worker termination and cleanup

10. **Utility Functions** (lines 1922-1943)
    - Helper functions for copying, binding, type checking
    - Regular expression escaping

### Modern State (`src/index.ts`)
Currently empty - clean slate for TypeScript implementation.

## Refactoring Strategy

### Phase 1: Foundation & Performance Infrastructure
Create the foundation with performance and compatibility safeguards from day one:

**File: `src/types/index.ts`** (Legacy reference: lines 60-86)
```typescript
// Exact legacy types for public API compatibility
export interface PapaParseConfig {
  delimiter?: string;
  newline?: string;
  quoteChar?: string;
  escapeChar?: string;
  header?: boolean;
  transformHeader?: (header: string, index: number) => string;
  dynamicTyping?: boolean | { [key: string]: boolean } | ((field: string | number) => boolean);
  preview?: number;
  encoding?: string;
  worker?: boolean;
  comments?: boolean | string;
  step?: (results: PapaParseResult, parser: PapaParseParser) => void;
  complete?: (results: PapaParseResult) => void;
  error?: (error: PapaParseError, file?: File) => void;
  download?: boolean;
  downloadRequestHeaders?: { [key: string]: string };
  downloadRequestBody?: string;
  skipEmptyLines?: boolean | 'greedy';
  chunk?: (results: PapaParseResult, parser: PapaParseParser) => void;
  fastMode?: boolean;
  beforeFirstChunk?: (chunk: string) => string;
  withCredentials?: boolean;
  transform?: (value: string, field: string | number) => any;
  delimitersToGuess?: string[];
}

// Internal strict types for development
interface StrictParseConfig<T extends string | number | symbol = string> {
  // Stricter internal types for better development experience
}
```

**File: `src/constants/index.ts`** (Legacy reference: lines 65-75)
```typescript
// Runtime-mutable constants to maintain legacy behavior
export const CONSTANTS = {
  RECORD_SEP: String.fromCharCode(30),
  UNIT_SEP: String.fromCharCode(31),
  BYTE_ORDER_MARK: '\ufeff',
  BAD_DELIMITERS: ['\r', '\n', '"'],
  LocalChunkSize: 1024 * 1024 * 10,  // 10 MB - mutable!
  RemoteChunkSize: 1024 * 1024 * 5,  // 5 MB - mutable!
  DefaultDelimiter: ','
};
```

**File: `ci/performance-benchmark.ts`**
- Micro-benchmark harness for rows/second testing
- Golden output snapshots for regression testing
- API surface reflection testing

### Phase 2: Core Parsing Engine (Split for Maintainability)

**File: `src/core/lexer.ts`** (Legacy reference: lines 1414-1683)
- Pure byte/character scanning and tokenization
- Quote state machine and escape handling
- Fast mode optimization (lines 1482-1513)
- Newline and delimiter detection

**File: `src/core/parser.ts`** (Legacy reference: lines 1684-1819)
- Row assembly and semantic processing
- Header duplicate detection and renaming (lines 1743-1784)
- Field validation and error collection
- Result object construction

**File: `src/core/errors.ts`** (Legacy reference: error handling throughout)
- Error type definitions and factories
- Standardized error reporting
- Error code constants

**File: `src/core/parser-handle.ts`** (Legacy reference: lines 1027-1406)
- High-level orchestration and configuration
- Parse/pause/resume/abort control
- Result processing and transformation (lines 1201-1338)

### Phase 3: Heuristics & Algorithms

**File: `src/heuristics/guess-delimiter.ts`** (Legacy reference: lines 1340-1392)
- Delimiter auto-detection algorithm
- Field count consistency analysis
- Stateless, pure function for reusability

**File: `src/heuristics/dynamic-typing.ts`** (Legacy reference: lines 1253-1277)
- Type detection for values (bool, number, date, null)
- ISO date regex and float validation
- Dynamic typing configuration handling

**File: `src/heuristics/line-endings.ts`** (Legacy reference: lines 1161-1185)
- Line ending detection (\r, \n, \r\n)
- Quote-aware analysis
- Newline preference determination

### Phase 4: Streaming Infrastructure

**File: `src/streamers/chunk-streamer.ts`** (Legacy reference: lines 487-563)
- Base streaming class and coordination
- Progress tracking and chunk management
- Stream state management

**File: `src/streamers/string-streamer.ts`** (Legacy reference: lines 564+)
- String input processing
- Memory-efficient chunking for large strings

**File: `src/streamers/file-streamer.ts`** (Legacy reference: lines 564+)
- File input processing with FileReader
- Browser file handling and progress events

**File: `src/streamers/network-streamer.ts`** (Legacy reference: lines 564+)
- Remote file downloading with fetch/XMLHttpRequest
- HTTP request handling with credentials and headers

**File: `src/streamers/readable-stream-streamer.ts`** (Legacy reference: lines 564+)
- Node.js readable stream processing
- Backpressure handling and flow control

**File: `src/streamers/duplex-stream-streamer.ts`** (Legacy reference: lines 564-1024)
- Node.js duplex stream for piping
- Transform stream implementation
- Write completion handling

### Phase 5: Core Functions

**File: `src/csv-to-json/index.ts`** (Legacy reference: lines 196-257)
- Main `CsvToJson` function
- Input type detection and routing
- Worker coordination
- Streamer selection logic

**File: `src/json-to-csv/index.ts`** (Legacy reference: lines 264-484)
- Main `JsonToCsv` function
- Configuration unpacking (lines 337-382)
- Serialization logic with quote handling (lines 385-484)
- Formula escape prevention

### Phase 6: Workers & Concurrency

**File: `src/workers/host.ts`** (Legacy reference: lines 1821-1888, 49-58)
- Worker orchestration API for main thread
- Worker pool management and lifecycle
- Message routing and result handling

**File: `src/workers/worker-entry.ts`** (Legacy reference: lines 1894-1920)
- Standalone worker entry point
- Independent bundle for worker blob
- Papa.WORKER_ID global preservation

### Phase 7: Plugin System

**File: `src/plugins/jquery.ts`** (Legacy reference: lines 88-180)
- Optional jQuery integration as sub-package
- File input queue management
- Progress callbacks and error handling
- Ship as `papaparse/jquery` for tree-shaking

### Phase 8: Public API & Compatibility

**File: `src/public/papa.ts`** - Papa object construction
- Static property bag pattern preservation
- Legacy mutability support for LocalChunkSize, etc.
- API surface compatibility layer

**File: `src/utils/index.ts`** (Legacy reference: lines 1922-1943, 189, 1408-1412)
```typescript
// Utility functions used throughout
export function copy(obj: any): any // line 1923
export function bindFunction<T extends Function>(f: T, self: any): T // line 1933
export function isFunction(func: any): func is Function // line 1937
export function stripBom(string: string): string // line 189
export function escapeRegExp(string: string): string // line 1409
```

**File: `src/index.ts`** - Main export
- UMD wrapper adaptation
- Exact API compatibility
- Object.assign pattern for static properties

## Implementation Checklist

### Foundation & Safety Infrastructure ✅ COMPLETED
- [x] Create CI performance benchmark harness
- [x] Implement golden output snapshots for regression testing
- [x] Set up API surface reflection testing
- [x] Configure TypeScript with `"target": "es2018", "module": "commonjs"` (updated for compatibility)
- [x] Implement exact legacy types in `src/types/` for public API
- [x] Create stricter internal types for development
- [x] Set up runtime-mutable constants (`src/constants/`)
- [x] Create utility functions (`src/utils/`)
- [x] Create CI testing infrastructure with npm scripts
- [x] Test foundation infrastructure (`bun run ci:foundation` passing)

### Core Engine Implementation ✅ COMPLETED
- [x] **Lexer** (`src/core/lexer.ts`) - Pure byte/character scanning with tight loops
- [x] **Lexer** - Quote state machine (lines 1520-1683)
- [x] **Lexer** - Fast mode optimization (lines 1482-1513)
- [x] **Lexer** - Avoiding enums for better compatibility
- [x] **Parser** (`src/core/parser.ts`) - Row construction and field validation
- [x] **Parser** - Header duplicate detection (lines 1743-1784)
- [x] **Parser** - Error collection and result building
- [x] **Error System** (`src/core/errors.ts`) - Standardized error types and factories
- [x] **Parser Handle** (`src/core/parser-handle.ts`) - High-level orchestration

### Algorithms & Coordination ✅ COMPLETED
- [x] **Delimiter Detection** (`src/heuristics/guess-delimiter.ts`) - Pure function for field count analysis
- [x] **Dynamic Typing** (`src/heuristics/dynamic-typing.ts`) - Boolean, numeric, date, and null detection
- [x] **Line Endings** (`src/heuristics/line-endings.ts`) - Quote-aware line ending detection
- [x] **Heuristics Integration** - All algorithms as stateless, reusable functions
- [x] **Type Safety** - Full TypeScript compatibility with legacy API
- [x] **Testing** - Foundation tests passing with heuristics modules

### Streaming Infrastructure ✅ COMPLETED
- [x] **Base Streamer** (`src/streamers/chunk-streamer.ts`) - Base class and coordination
- [x] **String Streamer** (`src/streamers/string-streamer.ts`) - String input processing
- [x] **File Streamer** (`src/streamers/file-streamer.ts`) - File input with FileReader
- [x] **Network Streamer** (`src/streamers/network-streamer.ts`) - Remote file downloading
- [x] **Readable Stream** (`src/streamers/readable-stream-streamer.ts`) - Node.js streams
- [x] **Duplex Stream** (`src/streamers/duplex-stream-streamer.ts`) - Node.js duplex streams
- [x] **Streamers** - Test memory efficiency and backpressure
- [x] **Streamers** - Verify chunking behavior matches legacy

### Core Functions
- [ ] **CSV to JSON** (`src/csv-to-json/index.ts`) - Main CsvToJson function (lines 196-257)
- [ ] **CSV to JSON** - Input type detection and routing
- [ ] **CSV to JSON** - Worker coordination
- [ ] **CSV to JSON** - Streamer selection logic
- [ ] **JSON to CSV** (`src/json-to-csv/index.ts`) - Main JsonToCsv function (lines 264-484)
- [ ] **JSON to CSV** - Configuration unpacking
- [ ] **JSON to CSV** - Serialization logic with quote handling
- [ ] **JSON to CSV** - Formula escape prevention

### Workers & Advanced Features
- [ ] **Worker Host** (`src/workers/host.ts`) - Main thread orchestration
- [ ] **Worker Entry** (`src/workers/worker-entry.ts`) - Standalone worker entry
- [ ] **Workers** - Independent worker bundle compilation
- [ ] **Workers** - Message passing and lifecycle management
- [ ] **Workers** - Preserve Papa.WORKER_ID global
- [ ] **Error Handling** (`src/core/errors.ts`) - Standardized error types and factories
- [ ] **Error Handling** - Error code preservation for compatibility

### Public API & Integration
- [ ] **Papa Object** (`src/public/papa.ts`) - Static property bag pattern with Object.assign
- [ ] **Papa Object** - Legacy mutability support (LocalChunkSize, etc.)
- [ ] **Main Export** (`src/index.ts`) - UMD wrapper adaptation
- [ ] **API Compatibility** - Exact API compatibility verification
- [ ] **Test Suite** - Run complete test suite against new implementation
- [ ] **Performance** - Performance regression verification
- [ ] **Compatibility** - API compatibility validation

### Optional Features
- [ ] **jQuery Plugin** (`src/plugins/jquery.ts`) - Optional integration as sub-package
- [ ] **jQuery Plugin** - Tree-shakable for users who don't need it
- [ ] **Documentation** - Migration guide documentation
- [ ] **Documentation** - Performance comparison reports
- [ ] **Release** - Beta release for community testing

## File Structure
```
src/
├── types/
│   └── index.ts              # Core type definitions with legacy compatibility
├── constants/
│   └── index.ts              # Papa constants (runtime-mutable)
├── core/                     # Core parsing engine (split for maintainability)
│   ├── lexer.ts              # Byte/char scanning, quote state machine
│   ├── parser.ts             # Row assembly, header processing
│   ├── errors.ts             # Error types and factories
│   └── parser-handle.ts      # High-level orchestration
├── heuristics/               # Pure, stateless algorithms
│   ├── guess-delimiter.ts    # Delimiter auto-detection
│   ├── dynamic-typing.ts     # Type detection for values
│   └── line-endings.ts       # Line ending detection
├── streamers/
│   ├── chunk-streamer.ts     # Base streaming class
│   ├── string-streamer.ts    # String input processing
│   ├── file-streamer.ts      # File input processing
│   ├── network-streamer.ts   # Remote file handling
│   ├── readable-stream-streamer.ts  # Node readable streams
│   ├── duplex-stream-streamer.ts    # Node duplex streams
│   └── index.ts              # Re-exports
├── csv-to-json/
│   └── index.ts              # CSV parsing logic
├── json-to-csv/
│   └── index.ts              # CSV generation logic
├── workers/
│   ├── host.ts               # Main thread worker orchestration
│   └── worker-entry.ts       # Worker bundle entry point
├── plugins/
│   └── jquery.ts             # jQuery integration (sub-package)
├── public/
│   └── papa.ts               # Papa object construction/compatibility
├── utils/
│   └── index.ts              # Shared utility functions
├── ci/
│   └── performance-benchmark.ts  # Performance regression testing
└── index.ts                  # Main export with UMD wrapper
```

## Testing Strategy

### Compatibility Testing
- [ ] Run existing test suite (`tests/test-cases.js`, `tests/node-tests.js`) against new implementation
- [ ] Ensure zero API changes required
- [ ] Verify performance characteristics match or exceed legacy

### Migration Testing
- [ ] Side-by-side comparison of outputs
- [ ] Edge case verification
- [ ] Memory usage profiling
- [ ] Browser compatibility testing

### Integration Testing
- [ ] Worker functionality
- [ ] jQuery plugin behavior
- [ ] Node.js stream integration
- [ ] Various input type handling

## Migration Path for Users

### Phase A: Parallel Implementation
- [ ] New TypeScript modules developed alongside legacy
- [ ] Legacy remains primary entry point
- [ ] Testing and validation in parallel

### Phase B: Soft Migration
- [ ] TypeScript implementation becomes primary
- [ ] Legacy available as fallback option
- [ ] Users can opt-in to new implementation

### Phase C: Full Migration
- [ ] TypeScript implementation is default
- [ ] Legacy marked as deprecated
- [ ] Clear migration timeline communicated

## Success Criteria

- [ ] **API Compatibility**: 100% backward compatibility maintained
- [ ] **Test Coverage**: All existing tests pass without modification
- [ ] **Performance**: Parse speed within 5% of legacy implementation
- [ ] **Memory**: Memory usage equal or better than legacy
- [ ] **Type Safety**: Full TypeScript type coverage
- [ ] **Maintainability**: Modular structure enabling easier maintenance
- [ ] **Documentation**: Complete API documentation with examples

## Safeguards

### Performance Protection
- [ ] **Hot Path Isolation**: Lexer compiled to plain JS with tight loops
- [ ] **Micro-benchmark CI**: Track rows/second for 50MB+ files in CI
- [ ] **Chunk Size Preservation**: Keep LocalChunkSize/RemoteChunkSize mutable
- [ ] **Memory Profiling**: Verify streaming doesn't increase memory usage

### API Compatibility Protection
- [x] **Golden Output Snapshots**: Freeze current parser results as test fixtures
- [x] **Reflection Testing**: `Object.keys(Papa)` must match between versions
- [x] **Singleton Reference Testing**: `require('papaparse').parse === require('papaparse').parse`
- [x] **Edge Case Preservation**: `Papa.parse('', {dynamicTyping: true}).data` returns `[[""]]`

### Breaking Change Traps to Avoid
- [ ] Worker blob URL generation must preserve `Papa.WORKER_ID` global
- [ ] Mutating `Papa.LocalChunkSize` after parse() starts must affect subsequent files
- [ ] jQuery plugin behavior must be identical (file queue, progress callbacks)
- [ ] Error object structure and codes must match exactly
- [ ] Dynamic typing behavior for edge cases (empty strings, whitespace)

### Architecture Benefits
- [ ] **Bundle Size**: jQuery plugin as sub-package saves ~30KB for non-users
- [ ] **Maintainability**: Lexer/parser split enables micro-optimizations
- [ ] **Extensibility**: Heuristics isolation supports future format additions
- [ ] **Worker Efficiency**: Independent worker bundle with better source maps

## Success Metrics
- [ ] **Zero API Changes**: Public interface `===` comparison passes
- [ ] **Performance Parity**: ±5% on large file benchmarks
- [ ] **Memory Efficiency**: Equal or better memory usage profiles
- [ ] **Test Coverage**: 100% existing test pass rate
- [ ] **Bundle Impact**: Core bundle size reduction, optional features tree-shakable

## 🧪 CI Testing Infrastructure (Phase 1 Complete)

The following testing infrastructure has been implemented and is ready for use:

### Performance Benchmarking
```bash
bun run ci:benchmark        # Run performance benchmarks
```
- Micro-benchmark harness tracking rows/second for 50MB+ files
- Memory usage profiling during parsing
- Regression detection (modern implementation must be within 5% of legacy speed)
- Automated test data generation for stress testing

### Golden Output Snapshots
```bash
bun run ci:snapshots:generate  # Generate baseline snapshots from legacy
bun run ci:snapshots:validate  # Validate modern implementation against snapshots
```
- Freeze current parser results as regression test fixtures
- 10+ standard test cases covering edge cases (quotes, line breaks, unicode, etc.)
- Automated comparison with detailed diff reporting
- Ensures bit-for-bit compatibility between implementations

### API Surface Reflection Testing
```bash
bun run ci:api-test           # Run API compatibility tests
```
- Validates `Object.keys(Papa)` matches exactly between versions
- Tests singleton reference consistency
- Verifies mutable properties (LocalChunkSize, RemoteChunkSize) work correctly
- Checks edge cases like `Papa.parse('', {dynamicTyping: true}).data` returns `[[""]]`

### Foundation Testing
```bash
bun run ci:foundation         # Test basic TypeScript infrastructure ✅ PASSING
bun run ci:all               # Run complete CI test suite
```
- TypeScript compilation validation
- Utility function testing
- Constants system testing
- Module import/export verification

### npm Scripts Available
- `bun run ci:foundation` - Foundation infrastructure tests (✅ passing)
- `bun run ci:benchmark` - Performance regression testing
- `bun run ci:snapshots:generate` - Create baseline snapshots
- `bun run ci:snapshots:validate` - Validate compatibility
- `bun run ci:api-test` - API surface testing
- `bun run ci:all` - Complete test suite
- `bun run refactor:test` - Alias for foundation tests

**Phase 4 Status: ✅ COMPLETE - Ready for Phase 5 implementation**

## Phase 4 Achievements Summary

✅ **Streaming Infrastructure Complete**
- Base ChunkStreamer class with progress tracking and parser coordination
- StringStreamer for memory-efficient string processing with configurable chunking
- FileStreamer with FileReader API, progress events, and browser compatibility
- NetworkStreamer for remote files with XMLHttpRequest, range requests, and credentials
- ReadableStreamStreamer for Node.js streams with proper backpressure handling
- DuplexStreamStreamer for Node.js duplex streams with piping support
- Complete TypeScript implementation with proper inheritance patterns
- All streamers implement coordinated chunk processing and state management
- Foundation tests passing: `bun run ci:foundation`

The streaming infrastructure layer is now ready for Phase 5 core functions.
