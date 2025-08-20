/**
 * Browser entry point for PapaParse V6
 * This file provides the UMD wrapper for browser usage
 */

// Import the Papa object
import Papa from "./index";

// Export for bundlers
export default Papa;

// Add to global scope if in browser context
if (typeof window !== "undefined" && window) {
  (window as any).Papa = Papa;
}
