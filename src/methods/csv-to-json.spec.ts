/**
 * Unit tests for CSV to JSON parsing function
 * Tests all branches and input type detection logic
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { NODE_STREAM_INPUT } from "../constants";
import { CsvToJson } from "./csv-to-json";

// Mock all dependencies
const mockStringStreamer = {
  stream: mock(() => ({ data: "string_result" })),
};

const mockNetworkStreamer = {
  stream: mock(() => ({ data: "network_result" })),
};

const mockFileStreamer = {
  stream: mock(() => ({ data: "file_result" })),
};

const mockReadableStreamStreamer = {
  stream: mock(() => ({ data: "readable_result" })),
};

const mockDuplexStreamStreamer = {
  getStream: mock(() => ({ pipe: () => {} })),
};

const mockWorker = {
  userStep: undefined,
  userChunk: undefined,
  userComplete: undefined,
  userError: undefined,
};

// Mock modules
mock.module("../streamers", () => ({
  StringStreamer: mock(() => mockStringStreamer),
  NetworkStreamer: mock(() => mockNetworkStreamer),
  FileStreamer: mock(() => mockFileStreamer),
  ReadableStreamStreamer: mock(() => mockReadableStreamStreamer),
  DuplexStreamStreamer: mock(() => mockDuplexStreamStreamer),
}));

mock.module("../workers/host", () => ({
  workersSupported: mock(() => true),
  newWorker: mock(() => mockWorker),
  sendWorkToWorker: mock(() => {}),
}));

mock.module("../utils", () => ({
  isFunction: mock((fn: any) => typeof fn === "function"),
  stripBom: mock((str: string) => str.replace(/^\uFEFF/, "")),
}));

describe("CsvToJson", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mock.restore();
  });

  test("handles worker parsing with successful worker creation", () => {
    const { workersSupported, newWorker, sendWorkToWorker } = require("../workers/host");
    workersSupported.mockReturnValue(true);
    newWorker.mockReturnValue(mockWorker);

    const config = {
      worker: true,
      step: () => {},
      chunk: () => {},
      complete: () => {},
      error: () => {},
    };

    const result = CsvToJson("test input", config);

    expect(workersSupported).toHaveBeenCalled();
    expect(newWorker).toHaveBeenCalled();
    expect(sendWorkToWorker).toHaveBeenCalled();
    expect(result).toBeUndefined(); // Worker case returns void
  });

  test("falls back from worker when worker creation fails", () => {
    const { workersSupported, newWorker } = require("../workers/host");
    const { StringStreamer } = require("../streamers");

    workersSupported.mockReturnValue(true);
    newWorker.mockReturnValue(null); // Worker creation fails

    const config = { worker: true };
    const result = CsvToJson("test input", config);

    expect(StringStreamer).toHaveBeenCalled();
    expect(result).toEqual({ data: "string_result" });
  });

  test("skips worker when workers not supported", () => {
    const { workersSupported } = require("../workers/host");
    const { StringStreamer } = require("../streamers");

    workersSupported.mockReturnValue(false);

    const config = { worker: true };
    const result = CsvToJson("test input", config);

    expect(StringStreamer).toHaveBeenCalled();
    expect(result).toEqual({ data: "string_result" });
  });

  test("handles NODE_STREAM_INPUT in Node.js context", () => {
    // Mock Node.js context by ensuring PAPA_BROWSER_CONTEXT is undefined
    const { DuplexStreamStreamer } = require("../streamers");

    const config = {};
    const result = CsvToJson(NODE_STREAM_INPUT, config);

    expect(DuplexStreamStreamer).toHaveBeenCalled();
    expect(result).toEqual({ pipe: expect.any(Function) });
  });

  test("handles string input with download flag", () => {
    const { NetworkStreamer } = require("../streamers");
    const { stripBom } = require("../utils");

    stripBom.mockReturnValue("cleaned input");

    const config = { download: true };
    const result = CsvToJson("test input", config);

    expect(stripBom).toHaveBeenCalledWith("test input");
    expect(NetworkStreamer).toHaveBeenCalled();
    expect(result).toEqual({ data: "network_result" });
  });

  test("handles string input without download flag", () => {
    const { StringStreamer } = require("../streamers");
    const { stripBom } = require("../utils");

    stripBom.mockReturnValue("cleaned input");

    const config = {};
    const result = CsvToJson("test input", config);

    expect(stripBom).toHaveBeenCalledWith("test input");
    expect(StringStreamer).toHaveBeenCalled();
    expect(result).toEqual({ data: "string_result" });
  });

  test("handles Node.js readable stream", () => {
    const { ReadableStreamStreamer } = require("../streamers");
    const { isFunction } = require("../utils");

    isFunction.mockReturnValue(true);

    const mockStream = {
      readable: true,
      read: () => {},
      on: () => {},
    };

    const config = {};
    const result = CsvToJson(mockStream, config);

    expect(ReadableStreamStreamer).toHaveBeenCalled();
    expect(result).toEqual({ data: "readable_result" });
  });

  test("handles File input", () => {
    const { FileStreamer } = require("../streamers");

    // Mock File constructor
    global.File = class File {} as any;
    const mockFile = new File([], "test.csv");

    const config = {};
    const result = CsvToJson(mockFile, config);

    expect(FileStreamer).toHaveBeenCalled();
    expect(result).toEqual({ data: "file_result" });
  });

  test("handles generic object input", () => {
    const { FileStreamer } = require("../streamers");

    const mockObject = { someProperty: "value" };

    const config = {};
    const result = CsvToJson(mockObject, config);

    expect(FileStreamer).toHaveBeenCalled();
    expect(result).toEqual({ data: "file_result" });
  });

  test("throws error for unsupported input type", () => {
    expect(() => {
      CsvToJson(123, {}); // Number input not supported
    }).toThrow("Unable to determine input type for parsing");
  });

  test("handles dynamic typing function configuration", () => {
    const { StringStreamer } = require("../streamers");

    const dynamicTypingFn = () => true;
    const config = { dynamicTyping: dynamicTypingFn };

    CsvToJson("test", config);

    // Should convert function to object and store function separately
    expect((config as any).dynamicTypingFunction).toBe(dynamicTypingFn);
    expect((config as any).dynamicTyping).toEqual({});
  });

  test("handles transform function configuration", () => {
    const { isFunction } = require("../utils");

    isFunction.mockImplementation((fn: any) => typeof fn === "function");

    const transformFn = (value: any) => value;
    const config = { transform: transformFn };

    CsvToJson("test", config);

    expect((config as any).transform).toBe(transformFn);
  });

  test("handles non-function transform configuration", () => {
    const { isFunction } = require("../utils");

    isFunction.mockImplementation((fn: any) => typeof fn === "function");

    const config = { transform: "not a function" };

    // @ts-expect-error - transform is not a function
    CsvToJson("test", config);

    expect((config as any).transform).toBe(false);
  });

  test("handles empty config", () => {
    const { StringStreamer } = require("../streamers");

    const result = CsvToJson("test");

    expect(StringStreamer).toHaveBeenCalled();
    expect(result).toEqual({ data: "string_result" });
  });
});
