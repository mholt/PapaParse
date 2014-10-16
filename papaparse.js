/*
	Papa Parse
	v3.1.3
	https://github.com/mholt/PapaParse
*/
(function(global)
{
	"use strict";

	var IS_WORKER = !global.document, SCRIPT_PATH;
	var workers = {}, workerIdCounter = 0;

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
		error: undefined,
		download: false,
		chunk: undefined,
		keepEmptyRows: false
	};

	global.Papa = {};

	global.Papa.parse = CsvToJson;
	global.Papa.unparse = JsonToCsv;

	global.Papa.RECORD_SEP = String.fromCharCode(30);
	global.Papa.UNIT_SEP = String.fromCharCode(31);
	global.Papa.BYTE_ORDER_MARK = "\ufeff";
	global.Papa.BAD_DELIMITERS = ["\r", "\n", "\"", global.Papa.BYTE_ORDER_MARK];
	global.Papa.WORKERS_SUPPORTED = !!global.Worker;

	// Configurable chunk sizes for local and remote files, respectively
	global.Papa.LocalChunkSize = 1024 * 1024 * 10;	// 10 MB
	global.Papa.RemoteChunkSize = 1024 * 1024 * 5;	// 5 MB
	global.Papa.DefaultDelimiter = ",";				// Used if not specified and detection fails

	// Exposed for testing and development only
	global.Papa.Parser = Parser;
	global.Papa.ParserHandle = ParserHandle;
	global.Papa.NetworkStreamer = NetworkStreamer;
	global.Papa.FileStreamer = FileStreamer;

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
					return;

				var f = queue[0];

				if (isFunction(options.before))
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
					if (isFunction(userCompleteFunc))
						userCompleteFunc(results, f.file, f.inputElem);
					fileComplete();
				};

				Papa.parse(f.file, f.instanceConfig);
			}

			function error(name, file, elem, reason)
			{
				if (isFunction(options.error))
					options.error({name: name}, file, elem, reason);
			}

			function fileComplete()
			{
				queue.splice(0, 1);
				parseNextFile();
			}
		}
	}


	if (IS_WORKER)
		global.onmessage = workerThreadReceivedMessage;
	else if (Papa.WORKERS_SUPPORTED)
		SCRIPT_PATH = getScriptPath();




	function CsvToJson(_input, _config)
	{
		var config = IS_WORKER ? _config : copyAndValidateConfig(_config);
		var useWorker = config.worker && Papa.WORKERS_SUPPORTED && SCRIPT_PATH;

		if (useWorker)
		{
			var w = newWorker();

			w.userStep = config.step;
			w.userChunk = config.chunk;
			w.userComplete = config.complete;
			w.userError = config.error;

			config.step = isFunction(config.step);
			config.chunk = isFunction(config.chunk);
			config.complete = isFunction(config.complete);
			config.error = isFunction(config.error);
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

					if (IS_WORKER)
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
						};
						reader.onerror = function()
						{
							if (isFunction(config.error))
								config.error(reader.error, _input);
						};
						reader.readAsText(_input, config.encoding);
					}
				}
			}
		}
	}






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
			if (typeof str === "undefined" || str === null)
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



	// TODO: Many of the functions of NetworkStreamer and FileStreamer are similar or the same. Consolidate?
	function NetworkStreamer(config)
	{
		config = config || {};
		if (!config.chunkSize)
			config.chunkSize = Papa.RemoteChunkSize;

		var start = 0, fileSize = 0;
		var aggregate = "";
		var partialLine = "";
		var xhr, url, nextChunk, finishedWithEntireFile;
		var handle = new ParserHandle(copy(config));
		handle.streamer = this;

		this.resume = function()
		{
			nextChunk();
		};

		this.finished = function()
		{
			return finishedWithEntireFile;
		};

		this.stream = function(u)
		{
			url = u;
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
		};

		function readChunk()
		{
			if (finishedWithEntireFile)
			{
				chunkLoaded();
				return;
			}

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

			finishedWithEntireFile = !config.step || start > getFileSize(xhr);

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
			else if (isFunction(config.chunk))
			{
				console.log("CHUNKED");
				config.chunk(results);
				results = undefined;
			}

			if (!finishedWithEntireFile && !results.meta.paused)
				nextChunk();
		}

		function chunkError()
		{
			if (isFunction(config.error))
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
	}









	function FileStreamer(config)
	{
		config = config || {};
		if (!config.chunkSize)
			config.chunkSize = Papa.LocalChunkSize;

		var start = 0;
		var file;
		var slice;
		var aggregate = "";
		var partialLine = "";
		var reader, nextChunk, slice, finishedWithEntireFile;
		var handle = new ParserHandle(copy(config));
		handle.streamer = this;

		// FileReader is better than FileReaderSync (even in worker) - see http://stackoverflow.com/q/24708649/1048862
		// But Firefox is a pill, too - see issue #76: https://github.com/mholt/PapaParse/issues/76
		var usingAsyncReader = typeof FileReader === 'function';

		this.stream = function(f)
		{
			file = f;
			slice = file.slice || file.webkitSlice || file.mozSlice;

			if (usingAsyncReader)
			{
				reader = new FileReader();		// Preferred method of reading files, even in workers
				reader.onload = chunkLoaded;
				reader.onerror = chunkError;
			}
			else
				reader = new FileReaderSync();	// Hack for running in a web worker in Firefox

			nextChunk();	// Starts streaming
		};

		this.finished = function()
		{
			return finishedWithEntireFile;
		};

		this.resume = function()
		{
			nextChunk();
		};

		function nextChunk()
		{
			if (!finishedWithEntireFile)
				readChunk();
		}

		function readChunk()
		{
			var end = Math.min(start + config.chunkSize, file.size);
			var txt = reader.readAsText(slice.call(file, start, end), config.encoding);
			if (!usingAsyncReader)
				chunkLoaded({ target: { result: txt } });	// mimic the async signature
		}

		function chunkLoaded(event)
		{
			// Very important to increment start each time before handling results
			start += config.chunkSize;

			// Rejoin the line we likely just split in two by chunking the file
			aggregate += partialLine + event.target.result;
			partialLine = "";

			finishedWithEntireFile = start >= file.size;

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
			else if (isFunction(config.chunk))
			{
				config.chunk(results, file);
				results = undefined;
			}

			if (!results || !results.meta.paused)
				nextChunk();
		}

		function chunkError()
		{
			if (isFunction(config.error))
				config.error(reader.error, file);
			else if (IS_WORKER && config.error)
			{
				global.postMessage({
					workerId: Papa.WORKER_ID,
					error: reader.error,
					file: file,
					finished: false
				});
			}
		}

	}





	// Use one ParserHandle per entire CSV file or string
	function ParserHandle(_config)
	{
		// One goal is to minimize the use of regular expressions...
		var FLOAT = /^\s*-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?\s*$/i;

		var self = this;
		var _stepCounter = 0;	// Number of times step was called (number of rows parsed)
		var _input;				// The input being parsed
		var _parser;			// The core parser being used
		var _paused = false;	// Whether we are paused or not
		var _delimiterError;	// Temporary state between delimiter detection and processing results
		var _fields = [];		// Fields are from the header row of the input, if there is one
		var _results = {		// The last results returned from the parser
			data: [],
			errors: [],
			meta: {}
		};

		if (isFunction(_config.step))
		{
			var userStep = _config.step;
			_config.step = function(results)
			{
				_results = results;
				if (needsHeaderRow())
					processResults();
				else	// only call user's step function after header row
				{
					_stepCounter += results.data.length;
					if (_config.preview && _stepCounter > _config.preview)
						_parser.abort();
					else
						userStep(processResults(), self);
				}
			};
		}

		this.parse = function(input)
		{
			//_stepCounter = 0;
			_delimiterError = false;
			if (!_config.delimiter)
			{
				var delimGuess = guessDelimiter(input);
				if (delimGuess.successful)
					_config.delimiter = delimGuess.bestDelimiter;
				else
				{
					_delimiterError = true;	// add error after parsing (otherwise it would be overwritten)
					_config.delimiter = Papa.DefaultDelimiter;
				}
				_results.meta.delimiter = _config.delimiter;
			}

			var parserConfig = copy(_config);
			if (_config.preview && _config.header)
				parserConfig.preview++;	// to compensate for header row

			_input = input;
			_parser = new Parser(parserConfig);
			_results = _parser.parse(_input);
			processResults();
			if (isFunction(_config.complete) && !_paused && (!self.streamer || self.streamer.finished()))
				_config.complete(_results);	// TODO: In some cases, when chunk is specified, this executes before the chunk function...
			return _paused ? { meta: { paused: true } } : (_results || { meta: { paused: false } });
		};

		this.pause = function()
		{
			_paused = true;
			_parser.abort();
			_input = _input.substr(_parser.getCharIndex());
		};

		this.resume = function()
		{
			_paused = false;
			_parser = new Parser(_config);
			_parser.parse(_input);
			if (!_paused)
			{
				if (self.streamer && !self.streamer.finished())
					self.streamer.resume();		// more of the file yet to come
				else if (isFunction(_config.complete))
					_config.complete(_results);
			}
		};

		this.abort = function()
		{
			_parser.abort();
			if (isFunction(_config.complete))
				_config.complete(_results);
			_input = "";
		};

		function processResults()
		{
			if (_results && _delimiterError)
			{
				addError("Delimiter", "UndetectableDelimiter", "Unable to auto-detect delimiting character; defaulted to '"+Papa.DefaultDelimiter+"'");
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
						else
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

			if (_config.header && _results.meta)
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











	function Parser(config)
	{
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
		var _runningRowIdx;		// Cumulative row index, used by the preview feature
		var _aborted = false;	// Abort flag

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

		this.abort = function()
		{
			_aborted = true;
		};

		this.getCharIndex = function()
		{
			 return _i;
		};

		function parserLoop()
		{
			while (_i < _input.length)
			{
				if (_aborted) break;
				if (_preview > 0 && _runningRowIdx >= _preview) break;

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
			if (!isFunction(_step))
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
			if (twoCharLineBreak(_i) || oneCharLineBreak(_i))
				_lineNum++;
			saveChar();
		}

		function parseNotInQuotes()
		{
			if (_ch == _delimiter)
				newField();
			else if (twoCharLineBreak(_i))
			{
				newRow();
				nextChar();
			}
			else if (oneCharLineBreak(_i))
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
			while (!twoCharLineBreak(_i)
				&& !oneCharLineBreak(_i)
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
			_runningRowIdx++;
			_data.push([]);
			_rowIdx = _data.length - 1;
			newField();
		}

		function endRow()
		{
			trimEmptyLastRow();
			if (isFunction(_step))
			{
				if (_data[_rowIdx])
					_step(returnable());
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
			return i < _input.length - 1 &&
				((_input[i] == "\r" && _input[i+1] == "\n")
				|| (_input[i] == "\n" && _input[i+1] == "\r"))
		}

		function oneCharLineBreak(i)
		{
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
			_i = 0, _runningRowIdx = 0, _lineNum = 1;
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
					aborted: _aborted,
					truncated: _preview > 0 && _i < _input.length
				}
			};
		}
	}



	function getScriptPath()
	{
		var id = "worker" + String(Math.random()).substr(2);
		document.write('<script id="'+id+'"></script>');
		return document.getElementById(id).previousSibling.src;
	}

	function newWorker()
	{
		if (!Papa.WORKERS_SUPPORTED)
			return false;
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
			if (isFunction(worker.userStep))
			{
				for (var i = 0; i < msg.results.data.length; i++)
				{
					worker.userStep({
						data: [msg.results.data[i]],
						errors: msg.results.errors,
						meta: msg.results.meta
					});
				}
				delete msg.results;	// free memory ASAP
			}
			else if (isFunction(worker.userChunk))
			{
				worker.userChunk(msg.results, msg.file);
				delete msg.results;
			}
		}

		if (msg.finished)
		{
			if (isFunction(workers[msg.workerId].userComplete))
				workers[msg.workerId].userComplete(msg.results);
			workers[msg.workerId].terminate();
			delete workers[msg.workerId];
		}
	}

	// Callback when worker thread receives a message
	function workerThreadReceivedMessage(e)
	{
		var msg = e.data;

		if (typeof Papa.WORKER_ID === 'undefined' && msg)
			Papa.WORKER_ID = msg.workerId;

		if (typeof msg.input === 'string')
		{
			global.postMessage({
				workerId: Papa.WORKER_ID,
				results: Papa.parse(msg.input, msg.config),
				finished: true
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

	// Replaces bad config values with good, default ones
	function copyAndValidateConfig(origConfig)
	{
		if (typeof origConfig !== 'object')
			origConfig = {};

		var config = copy(origConfig);

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

		if (typeof config.error !== 'function')
			config.error = DEFAULTS.error;

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

	function copy(obj)
	{
		if (typeof obj !== 'object')
			return obj;
		var cpy = obj instanceof Array ? [] : {};
		for (var key in obj)
			cpy[key] = copy(obj[key]);
		return cpy;
	}

	function isFunction(func)
	{
		return typeof func === 'function';
	}
})(this);
