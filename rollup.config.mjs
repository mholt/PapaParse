import { terser } from "rollup-plugin-terser";

export default {
	input: 'papaparse.mjs',
	output: [
		{
			name: 'Papa',
			file: 'papaparse.js',
			format: 'umd'
		},
		{
			name: 'Papa',
			file: 'papaparse.min.js',
			format: 'umd',
			plugins: [terser()]
		}
	],
	plugins: [
		{
			resolveImportMeta(prop, { format }) {
				if (format === 'umd') {
					if (prop === 'url') {
						return 'global && global.document && global.document.currentScript && global.document.currentScript.src';
					}
					if (prop === 'papaIsUMD') {
						return 'true';
					}
				}
			}
		}
	]
};
