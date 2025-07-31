/**
 * Environment detection matching legacy behavior
 */
export function detectEnvironment() {
  // Global object detection (matching legacy/papaparse.js lines 35-46)
  const global = (() => {
    if (typeof self !== "undefined") {
      return self;
    }
    if (typeof window !== "undefined") {
      return window;
    }
    if (typeof globalThis !== "undefined") {
      return globalThis;
    }
    // When running tests none of the above have been defined
    return {};
  })() as any;

  const IS_WORKER = !global.document && !!global.postMessage;
  const WORKERS_SUPPORTED = !IS_WORKER && !!global.Worker;

  return { global, IS_WORKER, WORKERS_SUPPORTED };
}
