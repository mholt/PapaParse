/**
 * Unit tests for dynamic typing functionality
 * Tests type detection, field configuration, and value transformation
 */

import { describe, expect, mock, test } from "bun:test";
import { parseDynamic, shouldApplyDynamicTyping, transformField } from "./dynamic-typing";

// Mock constants
mock.module("../constants", () => ({
  FLOAT: /^\s*-?(\d+\.?\d*|\d*\.?\d+)\s*$/,
  ISO_DATE: /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?Z?$/,
  MAX_FLOAT: Number.MAX_SAFE_INTEGER,
  MIN_FLOAT: Number.MIN_SAFE_INTEGER,
}));

describe("shouldApplyDynamicTyping", () => {
  test("returns true for boolean true", () => {
    const config = { dynamicTyping: true };
    expect(shouldApplyDynamicTyping("field", config)).toBe(true);
  });

  test("returns false for boolean false", () => {
    const config = { dynamicTyping: false };
    expect(shouldApplyDynamicTyping("field", config)).toBe(false);
  });

  test("returns true for object with field set to true", () => {
    const config = { dynamicTyping: { field: true } };
    expect(shouldApplyDynamicTyping("field", config)).toBe(true);
  });

  test("returns false for object with field set to false", () => {
    const config = { dynamicTyping: { field: false } };
    expect(shouldApplyDynamicTyping("field", config)).toBe(false);
  });

  test("returns false for object without field", () => {
    const config = { dynamicTyping: { otherField: true } };
    expect(shouldApplyDynamicTyping("field", config)).toBe(false);
  });

  test("returns true for function returning true", () => {
    const config = { dynamicTyping: (field: string | number) => field === "targetField" };
    expect(shouldApplyDynamicTyping("targetField", config)).toBe(true);
  });

  test("returns false for function returning false", () => {
    const config = { dynamicTyping: (field: string | number) => field === "targetField" };
    expect(shouldApplyDynamicTyping("otherField", config)).toBe(false);
  });

  test("caches function results in object", () => {
    const mockFn = mock((field: string | number) => field === "targetField");
    const config = {
      dynamicTyping: {},
      dynamicTypingFunction: mockFn,
    };

    // First call should invoke function
    expect(shouldApplyDynamicTyping("targetField", config)).toBe(true);
    expect(mockFn).toHaveBeenCalledWith("targetField");

    // Second call should use cached value
    mockFn.mockClear();
    expect(shouldApplyDynamicTyping("targetField", config)).toBe(true);
    expect(mockFn).not.toHaveBeenCalled();
  });

  test("returns false for undefined config", () => {
    const config = {};
    expect(shouldApplyDynamicTyping("field", config)).toBe(false);
  });
});

describe("parseDynamic", () => {
  test("returns original value when dynamic typing disabled", () => {
    const config = { dynamicTyping: false };
    expect(parseDynamic("field", "123", config)).toBe("123");
  });

  test("parses 'true' as boolean", () => {
    const config = { dynamicTyping: true };
    expect(parseDynamic("field", "true", config)).toBe(true);
  });

  test("parses 'TRUE' as boolean", () => {
    const config = { dynamicTyping: true };
    expect(parseDynamic("field", "TRUE", config)).toBe(true);
  });

  test("parses 'false' as boolean", () => {
    const config = { dynamicTyping: true };
    expect(parseDynamic("field", "false", config)).toBe(false);
  });

  test("parses 'FALSE' as boolean", () => {
    const config = { dynamicTyping: true };
    expect(parseDynamic("field", "FALSE", config)).toBe(false);
  });

  test("parses valid integer as number", () => {
    const config = { dynamicTyping: true };
    expect(parseDynamic("field", "123", config)).toBe(123);
  });

  test("parses valid float as number", () => {
    const config = { dynamicTyping: true };
    expect(parseDynamic("field", "123.45", config)).toBe(123.45);
  });

  test("parses negative number", () => {
    const config = { dynamicTyping: true };
    expect(parseDynamic("field", "-123.45", config)).toBe(-123.45);
  });

  test("parses valid ISO date string as Date", () => {
    const config = { dynamicTyping: true };
    const result = parseDynamic("field", "2023-01-01T12:00:00.000Z", config);
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2023);
  });

  test("parses empty string as null", () => {
    const config = { dynamicTyping: true };
    expect(parseDynamic("field", "", config)).toBe(null);
  });

  test("returns string for non-matching patterns", () => {
    const config = { dynamicTyping: true };
    expect(parseDynamic("field", "random text", config)).toBe("random text");
  });

  test("handles float with leading/trailing spaces", () => {
    const config = { dynamicTyping: true };
    expect(parseDynamic("field", "  123.45  ", config)).toBe(123.45);
  });

  test("rejects float outside safe range", () => {
    const config = { dynamicTyping: true };
    const veryLargeNumber = (Number.MAX_SAFE_INTEGER + 1).toString();
    expect(parseDynamic("field", veryLargeNumber, config)).toBe(veryLargeNumber);
  });

  test("handles field-specific typing", () => {
    const config = { dynamicTyping: { numField: true, strField: false } };
    expect(parseDynamic("numField", "123", config)).toBe(123);
    expect(parseDynamic("strField", "123", config)).toBe("123");
  });
});

describe("transformField", () => {
  test("returns value unchanged when no transform function", () => {
    expect(transformField("value", "field")).toBe("value");
  });

  test("applies transform function to string value", () => {
    const transform = (value: string, field: string | number) => value.toUpperCase();
    expect(transformField("hello", "field", transform)).toBe("HELLO");
  });

  test("passes field to transform function", () => {
    const transform = mock((value: string, field: string | number) => `${field}:${value}`);
    expect(transformField("test", "myField", transform)).toBe("myField:test");
    expect(transform).toHaveBeenCalledWith("test", "myField");
  });

  test("does not apply transform to non-string values", () => {
    const transform = mock((value: string) => value.toUpperCase());
    expect(transformField(123, "field", transform)).toBe(123);
    expect(transform).not.toHaveBeenCalled();
  });

  test("returns value unchanged when transform is undefined", () => {
    expect(transformField("value", "field", undefined)).toBe("value");
  });

  test("handles null values", () => {
    const transform = mock((value: string) => value.toUpperCase());
    expect(transformField(null, "field", transform)).toBe(null);
    expect(transform).not.toHaveBeenCalled();
  });

  test("handles Date values", () => {
    const date = new Date();
    const transform = mock((value: string) => value.toUpperCase());
    expect(transformField(date, "field", transform)).toBe(date);
    expect(transform).not.toHaveBeenCalled();
  });
});
