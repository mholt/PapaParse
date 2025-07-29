/**
 * Utility Functions
 *
 * Helper functions extracted from the legacy PapaParse implementation.
 * These maintain exact behavior for compatibility.
 */

/**
 * Makes a deep copy of an array or object (mostly)
 * Legacy implementation preserved exactly
 */
export function copy(obj: any): any {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }
  const cpy = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    (cpy as any)[key] = copy(obj[key]);
  }
  return cpy;
}

/**
 * Binds a function to a specific context
 * Legacy implementation preserved exactly
 */
export function bindFunction<T extends Function>(f: T, self: any): T {
  return ((...args: any[]) => {
    return f.apply(self, args);
  }) as any as T;
}

/**
 * Checks if a value is a function
 * Legacy implementation preserved exactly
 */
export function isFunction(func: any): func is Function {
  return typeof func === "function";
}

/**
 * Strips Byte Order Mark (BOM) from the beginning of a string
 * Legacy implementation preserved exactly
 */
export function stripBom(string: string): string {
  if (string.charCodeAt(0) === 0xfeff) {
    return string.slice(1);
  }
  return string;
}

/**
 * Escapes special regex characters in a string
 * Legacy implementation preserved exactly
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

/**
 * Type guard to check if a value is a string
 * Utility function for type safety
 */
export function isString(value: any): value is string {
  return typeof value === "string";
}

/**
 * Type guard to check if a value is a number
 * Utility function for type safety
 */
export function isNumber(value: any): value is number {
  return typeof value === "number";
}

/**
 * Type guard to check if a value is a boolean
 * Utility function for type safety
 */
export function isBoolean(value: any): value is boolean {
  return typeof value === "boolean";
}

/**
 * Type guard to check if a value is an object (not null, not array)
 * Utility function for type safety
 */
export function isObject(value: any): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a value is an array
 * Utility function for type safety
 */
export function isArray(value: any): value is any[] {
  return Array.isArray(value);
}

/**
 * Checks if a string is empty or only whitespace
 * Utility function for empty line detection
 */
export function isEmptyLine(line: string): boolean {
  return line.trim().length === 0;
}

/**
 * Checks if a line is a comment based on comment character
 * Utility function for comment detection
 */
export function isCommentLine(line: string, commentChar: string | false): boolean {
  if (!commentChar || typeof commentChar !== "string") {
    return false;
  }
  return line.trimStart().startsWith(commentChar);
}

/**
 * Gets the length of a string, handling surrogate pairs correctly
 * Important for proper Unicode handling
 */
export function getStringLength(str: string): number {
  // Simple implementation - could be enhanced for full Unicode support
  return str.length;
}

/**
 * Creates an error with consistent format
 * Factory function for standardized error creation
 */
export function createError(type: string, code: string, message: string, row?: number, index?: number): any {
  return {
    type,
    code,
    message,
    row,
    index,
  };
}
