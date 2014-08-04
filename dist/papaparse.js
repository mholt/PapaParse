/* PapaParse v3.0.2 
http://papaparse.com 
Build: 2014-07-28 */
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
'use strict';

var Parser = require('./src/Parser'),
	ParserHandle = require('./src/ParserHandle'),
	util = require('./src/util'),
	JsonToCsv = require('./src/JsonToCsv');

global.Papa = {};

module.exports = global.Papa;

global.Papa.RECORD_SEP = String.fromCharCode(30);
global.Papa.UNIT_SEP = String.fromCharCode(31);
global.Papa.BYTE_ORDER_MARK = "\ufeff";
global.Papa.BAD_DELIMITERS = ["\r", "\n", "\"", global.Papa.BYTE_ORDER_MARK];
global.Papa.WORKERS_SUPPORTED = !!global.Worker;

// Configurable chunk sizes for local and remote files, respectively
global.Papa.LocalChunkSize = 1024 * 1024 * 10;	// 10 MB
global.Papa.RemoteChunkSize = 1024 * 1024 * 5;	// 5 MB

//TODO Refactor this tangle of config code. This is required to pass in chunk sizing
var FileStreamer = require('./src/FileStreamer').setup(Papa),
	NetworkStreamer = require('./src/NetworkStreamer').setup(Papa)

// Exposed for testing and development only
global.Papa.Parser = Parser;
global.Papa.ParserHandle = ParserHandle;
global.Papa.NetworkStreamer = NetworkStreamer;
global.Papa.FileStreamer = FileStreamer;

global.Papa.unparse = JsonToCsv;
// TODO this is messy. Refactor worker code into module
global.Papa.parse = require('./src/CsvToJson').setup(newWorker); 

var SCRIPT_PATH;
var IS_WORKER = util.isWorker();
var workers = {};
var workerIdCounter = 0;

if (global.jQuery)
{
	var $ = global.jQuery;
	$.fn.parse = function(options)
	{
		var config = options.config || {};
		var queue = [];

		this.each(function(idx)
		{
			var supported = $(this).prop('tagName').toUpperCase() == "INPUT"
							&& $(this).attr('type').toLowerCase() == "file"
							&& global.FileReader;

			if (!supported || !this.files || this.files.length == 0)
				return true;	// continue to next input element

			for (var i = 0; i < this.files.length; i++)
			{
				queue.push({
					file: this.files[i],
					inputElem: this,
					instanceConfig: $.extend({}, config)
				});
			}
		});

		parseNextFile();	// begin parsing
		return this;		// maintains chainability


		function parseNextFile()
		{
			if (queue.length == 0)
			{
				if (util.isFunction(options.complete))
					options.complete();
				return;
			}

			var f = queue[0];

			if (util.isFunction(options.before))
			{
				var returned = options.before(f.file, f.inputElem);

				if (typeof returned === 'object')
				{
					if (returned.action == "abort")
					{
						error("AbortError", f.file, f.inputElem, returned.reason);
						return;	// Aborts all queued files immediately
					}
					else if (returned.action == "skip")
					{
						fileComplete();	// parse the next file in the queue, if any
						return;
					}
					else if (typeof returned.config === 'object')
						f.instanceConfig = $.extend(f.instanceConfig, returned.config);
				}
				else if (returned == "skip")
				{
					fileComplete();	// parse the next file in the queue, if any
					return;
				}
			}

			// Wrap up the user's complete callback, if any, so that ours also gets executed
			var userCompleteFunc = f.instanceConfig.complete;
			f.instanceConfig.complete = function(results)
			{
				if (util.isFunction(userCompleteFunc))
					userCompleteFunc(results, f.file, f.inputElem);
				fileComplete();
			};

			Papa.parse(f.file, f.instanceConfig);
		}

		function error(name, file, elem, reason)
		{
			if (util.isFunction(options.error))
				options.error({name: name}, file, elem, reason);
		}

		function fileComplete()
		{
			queue.splice(0, 1);
			parseNextFile();
		}
	}
}

if (IS_WORKER){
	global.onmessage = workerThreadReceivedMessage;
}
else if (Papa.WORKERS_SUPPORTED){
	SCRIPT_PATH = getScriptPath();
}

function getScriptPath() {
	var id = "worker" + String(Math.random()).substr(2);
	document.write('<script id="' + id + '"></script>');
	return document.getElementById(id).previousSibling.src;
}

function newWorker()
{
	if (!Papa.WORKERS_SUPPORTED || !SCRIPT_PATH) {
		return false;
	}
	var w = new global.Worker(SCRIPT_PATH);
	w.onmessage = mainThreadReceivedMessage;
	w.id = workerIdCounter++;
	workers[w.id] = w;
	return w;
}

// Callback when main thread receives a message
function mainThreadReceivedMessage(e)
{
	var msg = e.data;
	var worker = workers[msg.workerId];

	if (msg.error)
		worker.userError(msg.error, msg.file);
	else if (msg.results && msg.results.data)
	{
		if (util.isFunction(worker.userStep))
		{
			for (var i = 0; i < msg.results.data.length; i++)
			{
				worker.userStep({
					data: [msg.results.data[i]],
					errors: msg.results.errors,
					meta: msg.results.meta
				});
			}
		}
		else if (util.isFunction(worker.userChunk)) {
			worker.userChunk(msg.results, msg.file);
		}

		delete msg.results;	// free memory ASAP
	}

	if (msg.finished)
	{
		if (util.isFunction(workers[msg.workerId].userComplete)) {
			workers[msg.workerId].userComplete(msg.results);
		}
		workers[msg.workerId].terminate();
		delete workers[msg.workerId];
	}
}

// Callback when worker thread receives a message
function workerThreadReceivedMessage(e)
{
	var msg = e.data;

	if (typeof Papa.WORKER_ID === 'undefined' && msg) {
		Papa.WORKER_ID = msg.workerId;
	}

	if (typeof msg.input === 'string')
	{
		global.postMessage({
			workerId: Papa.WORKER_ID,
			results: Papa.parse(msg.input, msg.config),
			finished: true,
		});
	}
	else if (msg.input instanceof File)
	{
		var results = Papa.parse(msg.input, msg.config);
		if (results)
			global.postMessage({
				workerId: Papa.WORKER_ID,
				results: results,
				finished: true
			});
	}
}

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./src/CsvToJson":2,"./src/FileStreamer":3,"./src/JsonToCsv":4,"./src/NetworkStreamer":5,"./src/Parser":6,"./src/ParserHandle":7,"./src/util":9}],2:[function(require,module,exports){
module.exports = {
	setup: function(newWorker){

		var util = require('./util'),
			configUtil = require('./config'),
			FileStreamer = require('./FileStreamer'),
			NetworkStreamer = require('./NetworkStreamer'),
			ParserHandle = require('./ParserHandle');

		function CsvToJson(_input, _config)
		{
			var config = util.isWorker() ? _config : configUtil.copyAndValidateConfig(_config);
			var w = config.worker && util.isFunction(newWorker) ? newWorker() : false;

			if (w) {
				w.userStep = config.step;
				w.userChunk = config.chunk;
				w.userComplete = config.complete;
				w.userError = config.error;

				config.step = util.isFunction(config.step);
				config.chunk = util.isFunction(config.chunk);
				config.complete = util.isFunction(config.complete);
				config.error = util.isFunction(config.error);
				delete config.worker;	// prevent infinite loop

				w.postMessage({
					input: _input,
					config: config,
					workerId: w.id
				});
			}
			else
			{
				if (typeof _input === 'string')
				{
					if (config.download)
					{
						var streamer = new NetworkStreamer(config);
						streamer.stream(_input);
					}
					else
					{
						var ph = new ParserHandle(config);
						var results = ph.parse(_input);
						if (util.isFunction(config.complete))
							config.complete(results);
						return results;
					}
				}
				else if (_input instanceof File)
				{
					if (config.step || config.chunk)
					{
						var streamer = new FileStreamer(config);
						streamer.stream(_input);
					}
					else
					{
						var ph = new ParserHandle(config);

						if (util.isWorker())
						{
							var reader = new FileReaderSync();
							var input = reader.readAsText(_input, config.encoding);
							return ph.parse(input);
						}
						else
						{
							reader = new FileReader();
							reader.onload = function(event)
							{
								var ph = new ParserHandle(config);
								var results = ph.parse(event.target.result);
								if (util.isFunction(config.complete))
									config.complete(results);
							};
							reader.readAsText(_input, config.encoding);
						}
					}
				}
			}
		}

		return CsvToJson;
	}
};


},{"./FileStreamer":3,"./NetworkStreamer":5,"./ParserHandle":7,"./config":8,"./util":9}],3:[function(require,module,exports){
(function (global){
module.exports = {
	setup: function(Papa) {

		var util = require('./util');

		function FileStreamer(config)
		{
			config = config || {};
			if (!config.chunkSize) {
				config.chunkSize = Papa.LocalChunkSize;
			}
			
			var start = 0;
			var aggregate = "";
			var partialLine = "";
			var reader, nextChunk, slice;
			var handle = new ParserHandle(util.copy(config));

			this.stream = function(file)
			{
				var slice = file.slice || file.webkitSlice || file.mozSlice;
				
				reader = new FileReader();	// Better than FileReaderSync (even in worker). See: http://stackoverflow.com/q/24708649/1048862
				reader.onload = chunkLoaded;
				reader.onerror = chunkError;

				nextChunk();	// Starts streaming

				function nextChunk()
				{
					if (start < file.size)
						readChunk();
				}

				function readChunk()
				{
					var end = Math.min(start + config.chunkSize, file.size);
					var txt = reader.readAsText(slice.call(file, start, end), config.encoding);
					start += config.chunkSize;
					return txt;
				}

				function chunkLoaded(event)
				{
					// Rejoin the line we likely just split in two by chunking the file
					aggregate += partialLine + event.target.result;
					partialLine = "";

					var finishedWithEntireFile = start >= file.size;

					if (!finishedWithEntireFile)
					{
						var lastLineEnd = aggregate.lastIndexOf("\n");

						if (lastLineEnd < 0)
							lastLineEnd = aggregate.lastIndexOf("\r");

						if (lastLineEnd > -1)
						{
							partialLine = aggregate.substring(lastLineEnd + 1);	// skip the line ending character
							aggregate = aggregate.substring(0, lastLineEnd);
						}
						else
						{
							// For chunk sizes smaller than a line (a line could not fit in a single chunk)
							// we simply build our aggregate by reading in the next chunk, until we find a newline
							nextChunk();
							return;
						}
					}

					var results = handle.parse(aggregate);
					aggregate = "";

					if (util.isWorker())
					{
						global.postMessage({
							results: results,
							workerId: Papa.WORKER_ID,
							finished: finishedWithEntireFile
						});
					}
					else if (util.isFunction(config.chunk))
					{
						config.chunk(results, file);
						results = undefined;
					}
					
					if (finishedWithEntireFile && util.isFunction(config.complete))
						config.complete(undefined, file);
					else if (results && results.meta.aborted && util.isFunction(config.complete))	// TODO: Abort needs reworking like pause/resume need it (if streaming, no results object is returned, so it has no meta to say aborted: true...)
						config.complete(results, file);
					else if (!finishedWithEntireFile)
						nextChunk();
				}

				function chunkError()
				{
					if (util.isFunction(config.error))
						config.error(reader.error, file);
					else if (util.isWorker() && config.error)
					{
						global.postMessage({
							workerId: Papa.WORKER_ID,
							error: reader.error,
							file: file,
							finished: false
						});
					}
				}
			};
		}
		return FileStreamer;
	}
};

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./util":9}],4:[function(require,module,exports){
(function (global){
module.exports = JsonToCsv;

function JsonToCsv(_input, _config)
{
	var _output = "";
	var _fields = [];

	// Default configuration
	var _quotes = false;	// whether to surround every datum with quotes
	var _delimiter = ",";	// delimiting character
	var _newline = "\r\n";	// newline character(s)

	unpackConfig();

	if (typeof _input === 'string')
		_input = JSON.parse(_input);

	if (_input instanceof Array)
	{
		if (!_input.length || _input[0] instanceof Array)
			return serialize(null, _input);
		else if (typeof _input[0] === 'object')
			return serialize(objectKeys(_input[0]), _input);
	}
	else if (typeof _input === 'object')
	{
		if (typeof _input.data === 'string')
			_input.data = JSON.parse(_input.data);

		if (_input.data instanceof Array)
		{
			if (!_input.fields)
				_input.fields = _input.data[0] instanceof Array
								? _input.fields
								: objectKeys(_input.data[0]);

			if (!(_input.data[0] instanceof Array) && typeof _input.data[0] !== 'object')
				_input.data = [_input.data];	// handles input like [1,2,3] or ["asdf"]
		}

		return serialize(_input.fields || [], _input.data || []);
	}

	// Default (any valid paths should return before this)
	throw "exception: Unable to serialize unrecognized input";


	function unpackConfig()
	{
		if (typeof _config !== 'object')
			return;

		if (typeof _config.delimiter === 'string'
			&& _config.delimiter.length == 1
			&& global.Papa.BAD_DELIMITERS.indexOf(_config.delimiter) == -1)
		{
			_delimiter = _config.delimiter;
		}

		if (typeof _config.quotes === 'boolean'
			|| _config.quotes instanceof Array)
			_quotes = _config.quotes;

		if (typeof _config.newline === 'string')
			_newline = _config.newline;
	}


	// Turns an object's keys into an array
	function objectKeys(obj)
	{
		if (typeof obj !== 'object')
			return [];
		var keys = [];
		for (var key in obj)
			keys.push(key);
		return keys;
	}

	// The double for loop that iterates the data and writes out a CSV string including header row
	function serialize(fields, data)
	{
		var csv = "";

		if (typeof fields === 'string')
			fields = JSON.parse(fields);
		if (typeof data === 'string')
			data = JSON.parse(data);

		var hasHeader = fields instanceof Array && fields.length > 0;
		var dataKeyedByField = !(data[0] instanceof Array);

		// If there a header row, write it first
		if (hasHeader)
		{
			for (var i = 0; i < fields.length; i++)
			{
				if (i > 0)
					csv += _delimiter;
				csv += safe(fields[i], i);
			}
			if (data.length > 0)
				csv += _newline;
		}

		// Then write out the data
		for (var row = 0; row < data.length; row++)
		{
			var maxCol = hasHeader ? fields.length : data[row].length;

			for (var col = 0; col < maxCol; col++)
			{
				if (col > 0)
					csv += _delimiter;
				var colIdx = hasHeader && dataKeyedByField ? fields[col] : col;
				csv += safe(data[row][colIdx], col);
			}

			if (row < data.length - 1)
				csv += _newline;
		}

		return csv;
	}

	// Encloses a value around quotes if needed (makes a value safe for CSV insertion)
	function safe(str, col)
	{
		if (typeof str === "undefined")
			return "";

		str = str.toString().replace(/"/g, '""');

		var needsQuotes = (typeof _quotes === 'boolean' && _quotes)
						|| (_quotes instanceof Array && _quotes[col])
						|| hasAny(str, global.Papa.BAD_DELIMITERS)
						|| str.indexOf(_delimiter) > -1
						|| str.charAt(0) == ' '
						|| str.charAt(str.length - 1) == ' ';

		return needsQuotes ? '"' + str + '"' : str;
	}

	function hasAny(str, substrings)
	{
		for (var i = 0; i < substrings.length; i++)
			if (str.indexOf(substrings[i]) > -1)
				return true;
		return false;
	}
}

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],5:[function(require,module,exports){
(function (global){
module.exports = {
	setup: function(Papa) {
		
		var util = require('./util'),
			ParserHandle = require('./ParserHandle');

		// NOTE/TODO: Many of the functions of NetworkStreamer and FileStreamer are the same. Consolidate?
		function NetworkStreamer(config)
		{
			var IS_WORKER = util.isWorker();

			config = config || {};
			if (!config.chunkSize)
				config.chunkSize = Papa.RemoteChunkSize;

			var start = 0, fileSize = 0;
			var aggregate = "";
			var partialLine = "";
			var xhr, nextChunk;
			var handle = new ParserHandle(util.copy(config));

			this.stream = function(url)
			{
				if (IS_WORKER)
				{
					nextChunk = function()
					{
						readChunk();
						chunkLoaded();
					};
				}
				else
				{
					nextChunk = function()
					{
						readChunk();
					};
				}

				nextChunk();	// Starts streaming


				function readChunk()
				{
					xhr = new XMLHttpRequest();
					if (!IS_WORKER)
					{
						xhr.onload = chunkLoaded;
						xhr.onerror = chunkError;
					}
					xhr.open("GET", url, !IS_WORKER);
					if (config.step)
					{
						var end = start + config.chunkSize - 1;	// minus one because byte range is inclusive
						if (fileSize && end > fileSize) // Hack around a Chrome bug: http://stackoverflow.com/q/24745095/1048862
							end = fileSize;
						xhr.setRequestHeader("Range", "bytes="+start+"-"+end);
					}
					xhr.send();
					if (IS_WORKER && xhr.status == 0)
						chunkError();
					else
						start += config.chunkSize;
				}

				function chunkLoaded()
				{
					if (xhr.readyState != 4)
						return;

					if (xhr.status < 200 || xhr.status >= 400)
					{
						chunkError();
						return;
					}

					// Rejoin the line we likely just split in two by chunking the file
					aggregate += partialLine + xhr.responseText;
					partialLine = "";

					var finishedWithEntireFile = !config.step || start > getFileSize(xhr);

					if (!finishedWithEntireFile)
					{
						var lastLineEnd = aggregate.lastIndexOf("\n");

						if (lastLineEnd < 0)
							lastLineEnd = aggregate.lastIndexOf("\r");

						if (lastLineEnd > -1)
						{
							partialLine = aggregate.substring(lastLineEnd + 1);	// skip the line ending character
							aggregate = aggregate.substring(0, lastLineEnd);
						}
						else
						{
							// For chunk sizes smaller than a line (a line could not fit in a single chunk)
							// we simply build our aggregate by reading in the next chunk, until we find a newline
							nextChunk();
							return;
						}
					}

					var results = handle.parse(aggregate);
					aggregate = "";

					if (IS_WORKER)
					{
						global.postMessage({
							results: results,
							workerId: Papa.WORKER_ID,
							finished: finishedWithEntireFile
						});
					}
					else if (util.isFunction(config.chunk))
					{
						config.chunk(results);	// TODO: Implement abort? (like step)
						results = undefined;
					}
					
					if (finishedWithEntireFile && util.isFunction(config.complete))
						config.complete(results);
					else if (results && results.meta.aborted && util.isFunction(config.complete))
						config.complete(results);
					else if (!finishedWithEntireFile)
						nextChunk();
				}

				function chunkError()
				{
					if (util.isFunction(config.error))
						config.error(xhr.statusText);
					else if (IS_WORKER && config.error)
					{
						global.postMessage({
							workerId: Papa.WORKER_ID,
							error: xhr.statusText,
							finished: false
						});
					}
				}

				function getFileSize(xhr)
				{
					var contentRange = xhr.getResponseHeader("Content-Range");
					return parseInt(contentRange.substr(contentRange.lastIndexOf("/") + 1));
				}
			};
		}

		return NetworkStreamer;
	}
};
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./ParserHandle":7,"./util":9}],6:[function(require,module,exports){
module.exports = Parser;

var util = require('./util');

function Parser(config)
{
	var self = this;
	var EMPTY = /^\s*$/;

	var _input;		// The input text being parsed
	var _delimiter;	// The delimiting character
	var _comments;	// Comment character (default '#') or boolean
	var _step;		// The step (streaming) function
	var _callback;	// The callback to invoke when finished
	var _preview;	// Maximum number of lines (not rows) to parse
	var _ch;		// Current character
	var _i;			// Current character's positional index
	var _inQuotes;	// Whether in quotes or not
	var _lineNum;	// Current line number (1-based indexing)
	var _data;		// Parsed data (results)
	var _errors;	// Parse errors
	var _rowIdx;	// Current row index within results (0-based)
	var _colIdx;	// Current col index within result row (0-based)
	var _aborted = false;	// Abort flag
	var _paused = false;	// Pause flag

	// Unpack the config object
	config = config || {};
	_delimiter = config.delimiter;
	_comments = config.comments;
	_step = config.step;
	_preview = config.preview;

	// Delimiter integrity check
	if (typeof _delimiter !== 'string'
		|| _delimiter.length != 1
		|| Papa.BAD_DELIMITERS.indexOf(_delimiter) > -1)
		_delimiter = ",";

	// Comment character integrity check
	if (_comments === true)
		_comments = "#";
	else if (typeof _comments !== 'string'
		|| _comments.length != 1
		|| Papa.BAD_DELIMITERS.indexOf(_comments) > -1
		|| _comments == _delimiter)
		_comments = false;


	this.parse = function(input)
	{
		if (typeof input !== 'string')
			throw "Input must be a string";
		reset(input);
		return parserLoop();
	};
/*
	// TODO: Pause and resume just doesn't work well.
	// I suspect this may need to be implemented at a higher-level
	// scope than just this core Parser.
	this.pause = function()
	{
		_paused = true;
	};

	this.resume = function()
	{
		_paused = false;
		if (_i < _input.length)
			return parserLoop();
	};
*/
	this.abort = function()
	{
		_aborted = true;
	};

	function parserLoop()
	{
		while (_i < _input.length)
		{
			if (_aborted) break;
			if (_preview > 0 && _rowIdx >= _preview) break;
			if (_paused) return finishParsing();
			
			if (_ch == '"')
				parseQuotes();
			else if (_inQuotes)
				parseInQuotes();
			else
				parseNotInQuotes();

			nextChar();
		}

		return finishParsing();
	}

	function nextChar()
	{
		_i++;
		_ch = _input[_i];
	}

	function finishParsing()
	{
		if (_aborted)
			addError("Abort", "ParseAbort", "Parsing was aborted by the user's step function");
		if (_inQuotes)
			addError("Quotes", "MissingQuotes", "Unescaped or mismatched quotes");
		endRow();	// End of input is also end of the last row
		if (!util.isFunction(_step))
			return returnable();
	}

	function parseQuotes()
	{
		if (quotesOnBoundary() && !quotesEscaped())
			_inQuotes = !_inQuotes;
		else
		{
			saveChar();
			if (_inQuotes && quotesEscaped())
				_i++
			else
				addError("Quotes", "UnexpectedQuotes", "Unexpected quotes");
		}
	}

	function parseInQuotes()
	{
		saveChar();
	}

	function parseNotInQuotes()
	{
		if (_ch == _delimiter)
			newField();
		else if (twoCharLineBreak())
		{
			newRow();
			nextChar();
		}
		else if (oneCharLineBreak())
			newRow();
		else if (isCommentStart())
			skipLine();
		else
			saveChar();
	}

	function isCommentStart()
	{
		if (!_comments)
			return false;

		var firstCharOfLine = _i == 0
								|| oneCharLineBreak(_i-1)
								|| twoCharLineBreak(_i-2);
		return firstCharOfLine && _input[_i] === _comments;
	}

	function skipLine()
	{
		while (!twoCharLineBreak()
			&& !oneCharLineBreak()
			&& _i < _input.length)
		{
			nextChar();
		}
	}

	function saveChar()
	{
		_data[_rowIdx][_colIdx] += _ch;
	}

	function newField()
	{
		_data[_rowIdx].push("");
		_colIdx = _data[_rowIdx].length - 1;
	}

	function newRow()
	{
		endRow();

		_lineNum++;
		_data.push([]);
		_rowIdx = _data.length - 1;
		newField();
	}

	function endRow()
	{
		trimEmptyLastRow();
		if (util.isFunction(_step))
		{
			if (_data[_rowIdx])
				_step(returnable(), self);
			clearErrorsAndData();
		}
	}

	function trimEmptyLastRow()
	{
		if (_data[_rowIdx].length == 1 && EMPTY.test(_data[_rowIdx][0]))
		{
			if (config.keepEmptyRows)
				_data[_rowIdx].splice(0, 1);	// leave row, but no fields
			else
				_data.splice(_rowIdx, 1);		// cut out row entirely
			_rowIdx = _data.length - 1;
		}
	}

	function twoCharLineBreak(i)
	{
		if (typeof i !== 'number')
			i = _i;
		return i < _input.length - 1 && 
			((_input[i] == "\r" && _input[i+1] == "\n")
			|| (_input[i] == "\n" && _input[i+1] == "\r"))
	}

	function oneCharLineBreak(i)
	{
		if (typeof i !== 'number')
			i = _i;
		return _input[i] == "\r" || _input[i] == "\n";
	}

	function quotesEscaped()
	{
		// Quotes as data cannot be on boundary, for example: ,"", are not escaped quotes
		return !quotesOnBoundary() && _i < _input.length - 1 && _input[_i+1] == '"';
	}

	function quotesOnBoundary()
	{
		return (!_inQuotes && isBoundary(_i-1)) || isBoundary(_i+1);
	}

	function isBoundary(i)
	{
		if (typeof i != 'number')
			i = _i;

		var ch = _input[i];

		return (i <= -1 || i >= _input.length)
			|| (ch == _delimiter
				|| ch == "\r"
				|| ch == "\n");
	}

	function addError(type, code, msg)
	{
		_errors.push({
			type: type,
			code: code,
			message: msg,
			line: _lineNum,
			row: _rowIdx,
			index: _i
		});
	}

	function reset(input)
	{
		_input = input;
		_inQuotes = false;
		_lineNum = 1;
		_i = 0;
		clearErrorsAndData();
		_data = [ [""] ];	// starting parsing requires an empty field
		_ch = _input[_i];
	}

	function clearErrorsAndData()
	{
		_data = [];
		_errors = [];
		_rowIdx = 0;
		_colIdx = 0;
	}

	function returnable()
	{
		return {
			data: _data,
			errors: _errors,
			meta: {
				lines: _lineNum,
				delimiter: _delimiter,
				aborted: _aborted
			}
		};
	}
}


},{"./util":9}],7:[function(require,module,exports){
module.exports = ParserHandle;

var util = require('./util');
var Parser = require('./Parser');

// Use one ParserHandle per entire CSV file or string
function ParserHandle(_config)
{
	// One goal is to minimize the use of regular expressions...
	var FLOAT = /^\s*-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?\s*$/i;

	var _delimiterError;	// Temporary state between delimiter detection and processing results
	var _fields = [];		// Fields are from the header row of the input, if there is one
	var _results = {		// The last results returned from the parser
		data: [],
		errors: [],
		meta: {}
	};
	_config = util.copy(_config);

	this.parse = function(input)
	{
		_delimiterError = false;
		if (!_config.delimiter)
		{
			var delimGuess = guessDelimiter(input);
			if (delimGuess.successful)
				_config.delimiter = delimGuess.bestDelimiter;
			else
			{
				_delimiterError = true;	// add error after parsing (otherwise it would be overwritten)
				_config.delimiter = ",";
			}
			_results.meta.delimiter = _config.delimiter;
		}

		if (util.isFunction(_config.step))
		{
			var userStep = _config.step;
			_config.step = function(results, parser)
			{
				_results = results;
				if (needsHeaderRow())
					processResults();
				else
					userStep(processResults(), parser);
			};
		}

		_results = new Parser(_config).parse(input);
		return processResults();
	};

	function processResults()
	{
		if (_results && _delimiterError)
		{
			addError("Delimiter", "UndetectableDelimiter", "Unable to auto-detect delimiting character; defaulted to comma");
			_delimiterError = false;
		}

		if (needsHeaderRow())
			fillHeaderFields();

		return applyHeaderAndDynamicTyping();
	}

	function needsHeaderRow()
	{
		return _config.header && _fields.length == 0;
	}

	function fillHeaderFields()
	{
		if (!_results)
			return;
		for (var i = 0; needsHeaderRow() && i < _results.data.length; i++)
			for (var j = 0; j < _results.data[i].length; j++)
				_fields.push(_results.data[i][j]);
		_results.data.splice(0, 1);
	}

	function applyHeaderAndDynamicTyping()
	{
		if (!_results || (!_config.header && !_config.dynamicTyping))
			return _results;

		for (var i = 0; i < _results.data.length; i++)
		{
			var row = {};
			for (var j = 0; j < _results.data[i].length; j++)
			{
				if (_config.dynamicTyping)
				{
					var value = _results.data[i][j];
					if (value == "true")
						_results.data[i][j] = true;
					else if (value == "false")
						_results.data[i][j] = false;
					else
						_results.data[i][j] = tryParseFloat(value);
				}

				if (_config.header)
				{
					if (j >= _fields.length)
					{
						if (!row["__parsed_extra"])
							row["__parsed_extra"] = [];
						row["__parsed_extra"].push(_results.data[i][j]);
					}
					row[_fields[j]] = _results.data[i][j];
				}
			}

			if (_config.header)
			{
				_results.data[i] = row;
				if (j > _fields.length)
					addError("FieldMismatch", "TooManyFields", "Too many fields: expected " + _fields.length + " fields but parsed " + j, i);
				else if (j < _fields.length)
					addError("FieldMismatch", "TooFewFields", "Too few fields: expected " + _fields.length + " fields but parsed " + j, i);
			}
		}

		if (_config.header && _results.meta);
			_results.meta.fields = _fields;

		return _results;
	}

	function guessDelimiter(input)
	{
		var delimChoices = [",", "\t", "|", ";", Papa.RECORD_SEP, Papa.UNIT_SEP];
		var bestDelim, bestDelta, fieldCountPrevRow;

		for (var i = 0; i < delimChoices.length; i++)
		{
			var delim = delimChoices[i];
			var delta = 0, avgFieldCount = 0;
			fieldCountPrevRow = undefined;

			var preview = new Parser({
				delimiter: delim,
				preview: 10
			}).parse(input);

			for (var j = 0; j < preview.data.length; j++)
			{
				var fieldCount = preview.data[j].length;
				avgFieldCount += fieldCount;

				if (typeof fieldCountPrevRow === 'undefined')
				{
					fieldCountPrevRow = fieldCount;
					continue;
				}
				else if (fieldCount > 1)
				{
					delta += Math.abs(fieldCount - fieldCountPrevRow);
					fieldCountPrevRow = fieldCount;
				}
			}

			avgFieldCount /= preview.data.length;

			if ((typeof bestDelta === 'undefined' || delta < bestDelta)
				&& avgFieldCount > 1.99)
			{
				bestDelta = delta;
				bestDelim = delim;
			}
		}

		_config.delimiter = bestDelim;

		return {
			successful: !!bestDelim,
			bestDelimiter: bestDelim
		}
	}

	function tryParseFloat(val)
	{
		var isNumber = FLOAT.test(val);
		return isNumber ? parseFloat(val) : val;
	}

	function addError(type, code, msg, row)
	{
		_results.errors.push({
			type: type,
			code: code,
			message: msg,
			row: row
		});
	}
}

},{"./Parser":6,"./util":9}],8:[function(require,module,exports){
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


},{"./util":9}],9:[function(require,module,exports){
(function (global){
module.exports = {
	copy: copy,
	isFunction: isFunction,
	isWorker: isWorker
}

function isFunction(func) {
	return typeof func === 'function';
}

function copy(obj) {
	if (typeof obj !== 'object') {
		return obj;
	}
	var cpy = obj instanceof Array ? [] : {};
	for (var key in obj) {
		cpy[key] = copy(obj[key]);
	}
	return cpy;
}

function isWorker() {
	return !global.document;
}

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[1]);