module.exports = {
	copyAndValidateConfig: copyAndValidateConfig
};

var util = require('./util');

// A configuration object from which to draw default settings
var DEFAULTS = {
	delimiter: "",	// empty: auto-detect
	header: false,
	dynamicTyping: false,
	preview: 0,
	step: undefined,
	encoding: "",	// browser should default to "UTF-8"
	worker: false,
	comments: false,
	complete: undefined,
	download: false,
	keepEmptyRows: false
};


// Replaces bad config values with good, default ones
function copyAndValidateConfig(origConfig)
{
	if (typeof origConfig !== 'object')
		origConfig = {};

	var config = util.copy(origConfig);

	if (typeof config.delimiter !== 'string'
		|| config.delimiter.length != 1
		|| Papa.BAD_DELIMITERS.indexOf(config.delimiter) > -1)
		config.delimiter = DEFAULTS.delimiter;

	if (typeof config.header !== 'boolean')
		config.header = DEFAULTS.header;

	if (typeof config.dynamicTyping !== 'boolean')
		config.dynamicTyping = DEFAULTS.dynamicTyping;

	if (typeof config.preview !== 'number')
		config.preview = DEFAULTS.preview;

	if (typeof config.step !== 'function')
		config.step = DEFAULTS.step;

	if (typeof config.complete !== 'function')
		config.complete = DEFAULTS.complete;

	if (typeof config.encoding !== 'string')
		config.encoding = DEFAULTS.encoding;

	if (typeof config.worker !== 'boolean')
		config.worker = DEFAULTS.worker;

	if (typeof config.download !== 'boolean')
		config.download = DEFAULTS.download;

	if (typeof config.keepEmptyRows !== 'boolean')
		config.keepEmptyRows = DEFAULTS.keepEmptyRows;

	return config;
}

