import { PapaParseConfig } from "../types/index.js";

// Constants for dynamic typing (from legacy lines 1031-1034)
const MAX_FLOAT = Math.pow(2, 53);
const MIN_FLOAT = -MAX_FLOAT;
const FLOAT = /^\s*-?(\d+\.?|\.\d+|\d+\.\d+)([eE][-+]?\d+)?\s*$/;
const ISO_DATE =
  /^((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)))$/;

export interface DynamicTypingConfig {
  dynamicTyping?:
    | boolean
    | { [key: string]: boolean }
    | ((field: string | number) => boolean);
  dynamicTypingFunction?: (field: string | number) => boolean;
  [key: string]: any;
}

/**
 * Test if a string represents a valid float within safe range
 * Based on legacy implementation lines 1191-1199
 */
function testFloat(value: string): boolean {
  if (FLOAT.test(value)) {
    const floatValue = parseFloat(value);
    if (floatValue > MIN_FLOAT && floatValue < MAX_FLOAT) {
      return true;
    }
  }
  return false;
}

/**
 * Check if dynamic typing should be applied to a field
 * Based on legacy implementation lines 1253-1259
 */
export function shouldApplyDynamicTyping(
  field: string | number,
  config: DynamicTypingConfig,
): boolean {
  // Cache function values to avoid calling it for each row
  if (
    config.dynamicTypingFunction &&
    typeof config.dynamicTyping === "object" &&
    config.dynamicTyping[field] === undefined
  ) {
    config.dynamicTyping[field] = config.dynamicTypingFunction(field);
  }

  if (typeof config.dynamicTyping === "boolean") {
    return config.dynamicTyping;
  } else if (typeof config.dynamicTyping === "object") {
    return config.dynamicTyping[field] === true;
  } else if (typeof config.dynamicTyping === "function") {
    return config.dynamicTyping(field);
  }

  return false;
}

/**
 * Parse a field value with dynamic typing
 * Based on legacy implementation lines 1261-1277
 */
export function parseDynamic(
  field: string | number,
  value: string,
  config: DynamicTypingConfig,
): any {
  if (shouldApplyDynamicTyping(field, config)) {
    if (value === "true" || value === "TRUE") {
      return true;
    } else if (value === "false" || value === "FALSE") {
      return false;
    } else if (testFloat(value)) {
      return parseFloat(value);
    } else if (ISO_DATE.test(value)) {
      return new Date(value);
    } else {
      return value === "" ? null : value;
    }
  }
  return value;
}

/**
 * Transform a field value using optional transform function
 * Based on legacy transform functionality
 */
export function transformField(
  value: any,
  field: string | number,
  transformFunction?: (value: string, field: string | number) => any,
): any {
  if (transformFunction && typeof value === "string") {
    return transformFunction(value, field);
  }
  return value;
}
