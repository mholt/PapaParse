/**
 * jQuery Plugin for PapaParse
 * Optional jQuery integration as a tree-shakable sub-package
 *
 * Usage:
 * import Papa from 'papaparse';
 * import 'papaparse/jquery'; // Enables $(input).parse()
 *
 * Legacy compatibility:
 * The plugin is automatically registered if jQuery is available globally
 */

import type { PapaObject } from "../public/papa";
import { isFunction } from "../utils";
import type { PapaParseConfig, PapaParseResult } from "../types";

// jQuery type definitions for TypeScript compatibility
interface JQuery {
  each(callback: (index: number, element: Element) => any): JQuery;
  prop(propertyName: string): any;
  attr(attributeName: string): string | undefined;
  extend(...objects: any[]): any;
  parse(options: JQueryParseOptions): JQuery;
}

interface JQueryParseOptions {
  config?: PapaParseConfig;
  before?: (file: File, inputElem: Element) => any;
  error?: (error: { name: string }, file: File, inputElem: Element, reason?: string) => void;
  complete?: () => void;
}

interface FileQueueItem {
  file: File;
  inputElem: Element;
  instanceConfig: PapaParseConfig;
}

declare global {
  interface Window {
    jQuery?: {
      fn: {
        parse?: (options: JQueryParseOptions) => JQuery;
      };
      extend: (...objects: any[]) => any;
    };
    $?: {
      fn: {
        parse?: (options: JQueryParseOptions) => JQuery;
      };
      extend: (...objects: any[]) => any;
    };
  }
}

/**
 * jQuery plugin implementation for file input parsing
 * Handles multiple file inputs with queue management and progress callbacks
 */
export function createJQueryPlugin($: any, Papa?: PapaObject): void {
  $.fn.parse = function (options: JQueryParseOptions): JQuery {
    const config = options.config || {};
    const queue: FileQueueItem[] = [];

    // Iterate through selected elements and build file queue
    this.each(function (this: any, idx: number) {
      const element = this as any;
      const $this = $(element);
      const supported =
        $this.prop("tagName").toUpperCase() === "INPUT" &&
        $this.attr("type")?.toLowerCase() === "file" &&
        typeof FileReader !== "undefined";

      if (!supported || !element.files || element.files.length === 0) {
        return true; // continue to next input element
      }

      for (let i = 0; i < element.files.length; i++) {
        queue.push({
          file: element.files[i],
          inputElem: element,
          instanceConfig: $.extend({}, config),
        });
      }

      return true; // Always return true to continue iteration
    });

    parseNextFile(); // begin parsing
    return this; // maintains chainability

    function parseNextFile(): void {
      if (queue.length === 0) {
        if (isFunction(options.complete)) {
          options.complete!();
        }
        return;
      }

      const f = queue[0];

      if (isFunction(options.before)) {
        const returned = options.before!(f.file, f.inputElem);

        if (typeof returned === "object") {
          if (returned.action === "abort") {
            error("AbortError", f.file, f.inputElem, returned.reason);
            return; // Aborts all queued files immediately
          } else if (returned.action === "skip") {
            fileComplete(); // parse the next file in the queue, if any
            return;
          } else if (typeof returned.config === "object") {
            f.instanceConfig = $.extend(f.instanceConfig, returned.config);
          }
        } else if (returned === "skip") {
          fileComplete(); // parse the next file in the queue, if any
          return;
        }
      }

      // Wrap up the user's complete callback, if any, so that ours also gets executed
      const userCompleteFunc = f.instanceConfig.complete;
      f.instanceConfig.complete = function (results: PapaParseResult) {
        if (isFunction(userCompleteFunc)) {
          userCompleteFunc!(results);
        }
        fileComplete();
      };

      // Use provided Papa instance or look for global Papa
      const PapaInstance = Papa || (typeof window !== "undefined" && (window as any).Papa);
      if (!PapaInstance) {
        throw new Error("Papa object not available. Ensure PapaParse is loaded.");
      }
      PapaInstance.parse(f.file, f.instanceConfig);
    }

    function error(name: string, file: File, elem: Element, reason?: string): void {
      if (isFunction(options.error)) {
        options.error!({ name }, file, elem, reason);
      }
    }

    function fileComplete(): void {
      queue.splice(0, 1);
      parseNextFile();
    }
  };
}

/**
 * Auto-register plugin if jQuery is available globally
 * This maintains backward compatibility with existing code
 */
export function autoRegisterJQueryPlugin(Papa?: PapaObject): void {
  if (typeof window !== "undefined") {
    const global = window as any;
    if (global.jQuery) {
      createJQueryPlugin(global.jQuery, Papa);
    }
    if (global.$ && global.$ !== global.jQuery) {
      createJQueryPlugin(global.$, Papa);
    }
  }
}

/**
 * Manual plugin registration for modern module usage
 * Import this function to explicitly register the plugin
 */
export function registerJQueryPlugin($?: any, Papa?: PapaObject): void {
  if ($) {
    createJQueryPlugin($, Papa);
  } else {
    autoRegisterJQueryPlugin(Papa);
  }
}

// Export the plugin for tree-shaking compatibility
export default {
  createJQueryPlugin,
  autoRegisterJQueryPlugin,
  registerJQueryPlugin,
};
