import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: {
    // ESM and CJS builds
    papaparse: "src/index.ts",
    "cjs-entry": "src/cjs-entry.ts",
    // IIFE build for browser with global Papa variable
    "papaparse.browser": "src/browser-entry.ts",
  },
  format: ["cjs", "esm", "iife"],
  target: "es2015",
  dts: !options.minify, // Only generate types for non-minified builds
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: options.minify || false,
  treeshake: true,
  globalName: "Papa",
  esbuildOptions(options) {
    // Ensure proper format handling
    if (options.format === "iife") {
      options.platform = "browser";
    }
  },
  outExtension({ format, options }) {
    const ext = format === "iife" ? ".iife" : format === "cjs" ? ".js" : ".mjs";
    const min = options.minify ? ".min" : "";
    return {
      js: `${ext}${min}.js`,
    };
  },
}));
