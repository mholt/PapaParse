/**
 * CommonJS Entry Point for PapaParse V6
 *
 * This file provides the Papa object directly for CommonJS compatibility
 * Used for testing against the existing test suite
 */

import { Papa } from "./public/papa";

// Export Papa directly for CommonJS (no default wrapper)
export = Papa;
