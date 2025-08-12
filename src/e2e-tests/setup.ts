import { Window } from "happy-dom";

// Create a window instance and register DOM APIs globally for all tests
const window = new Window();

// Selectively assign important globals
global.window = window;
global.document = window.document;
global.File = window.File;
global.FileReader = window.FileReader;
global.Blob = window.Blob;
global.URL = window.URL;

// Add some additional globals that might be needed
global.FileReaderSync = class FileReaderSync {
  readAsText(file: File): string {
    // Simple synchronous file reader implementation for testing
    if ((file as any).textContent) {
      return (file as any).textContent;
    }
    // Fallback for regular File objects
    return "";
  }
};

// Mock Worker for testing
global.Worker = class Worker {
  constructor(scriptURL: string, options?: WorkerOptions) {
    // Mock worker that doesn't actually spawn a thread
  }

  postMessage(message: any): void {
    // Mock implementation
  }

  terminate(): void {
    // Mock implementation
  }

  addEventListener(type: string, listener: any): void {
    // Mock implementation
  }

  removeEventListener(type: string, listener: any): void {
    // Mock implementation
  }
} as any;

// Ensure we have the right globals
if (typeof global.File === "undefined") {
  console.warn("File constructor not available in test environment");
}

if (typeof global.FileReader === "undefined") {
  console.warn("FileReader not available in test environment");
}
