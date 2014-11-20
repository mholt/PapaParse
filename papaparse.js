/*
	Papa Parse
	v4.0.4
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
		newline: "",	// empty: auto-detect
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
		skipEmptyLines: false,
		fastMode: false
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
				{
					if (isFunction(options.complete))
						options.complete();
					return;
				}

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

		var start = 0, fileSize = 0, rowCount = 0;
		var aggregate = "";
		var partialLine = "";
		var xhr, url, nextChunk, finishedWithEntireFile;
		var userComplete, handle, configCopy;
		replaceConfig(config);

		this.resume = function()
		{
			paused = false;
			nextChunk();
		};

		this.finished = function()
		{
			return finishedWithEntireFile;
		};

		this.pause = function()
		{
			paused = true;
		};

		this.abort = function()
		{
			finishedWithEntireFile = true;
			if (isFunction(userComplete))
				userComplete({ data: [], errors: [], meta: { aborted: true } });
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
			
			if (config.step || config.chunk)
			{
				var end = start + configCopy.chunkSize - 1;	// minus one because byte range is inclusive
				if (fileSize && end > fileSize)	// Hack around a Chrome bug: http://stackoverflow.com/q/24745095/1048862
					end = fileSize;
				xhr.setRequestHeader("Range", "bytes="+start+"-"+end);
			}

			try {
				xhr.send();
			}
			catch (err) {
				chunkError(err.message);
			}

			if (IS_WORKER && xhr.status == 0)
				chunkError();
			else
				start += configCopy.chunkSize;
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

			finishedWithEntireFile = (!config.step && !config.chunk) || start > getFileSize(xhr);

			if (!finishedWithEntireFile)
			{
				var lastLineEnd = aggregate.lastIndexOf("\r");

				if (lastLineEnd == -1)
					lastLineEnd = aggregate.lastIndexOf("\n");

				if (lastLineEnd != -1)
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
			if (results && results.data)
				rowCount += results.data.length;

			var finishedIncludingPreview = finishedWithEntireFile || (configCopy.preview && rowCount >= configCopy.preview);

			if (IS_WORKER)
			{
				global.postMessage({
					results: results,
					workerId: Papa.WORKER_ID,
					finished: finishedIncludingPreview
				});
			}
			else if (isFunction(config.chunk))
			{
				config.chunk(results, handle);
				results = undefined;
			}

			if (isFunction(userComplete) && finishedIncludingPreview)
				userComplete(results);

			if (!finishedIncludingPreview && (!results || !results.meta.paused))
				nextChunk();
		}

		function chunkError(errorMessage)
		{
			var errorText = xhr.statusText || errorMessage;
			if (isFunction(config.error))
				config.error(errorText);
			else if (IS_WORKER && config.error)
			{
				global.postMessage({
					workerId: Papa.WORKER_ID,
					error: errorText,
					finished: false
				});
			}
		}

		function getFileSize(xhr)
		{
			var contentRange = xhr.getResponseHeader("Content-Range");
			return parseInt(contentRange.substr(contentRange.lastIndexOf("/") + 1));
		}

		function replaceConfig(config)
		{
			// Deep-copy the config so we can edit it; we need
			// to call the complete function if we are to ensure
			// that the last chunk callback, if any, will be called
			// BEFORE the complete function.
			configCopy = copy(config);
			userComplete = configCopy.complete;
			configCopy.complete = undefined;
			configCopy.chunkSize = parseInt(configCopy.chunkSize);	// VERY important so we don't concatenate strings!
			handle = new ParserHandle(configCopy);
			handle.streamer = this;
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
		var rowCount = 0;
		var paused = false;
		var self = this;
		var reader, nextChunk, slice, finishedWithEntireFile;
		var userComplete, handle, configCopy;
		replaceConfig(config);

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

		this.pause = function()
		{
			paused = true;
		};

		this.resume = function()
		{
			paused = false;
			nextChunk();
		};

		this.abort = function()
		{
			finishedWithEntireFile = true;
			if (isFunction(userComplete))
				userComplete({ data: [], errors: [], meta: { aborted: true } });
		};

		function nextChunk()
		{
			if (!finishedWithEntireFile && (!configCopy.preview || rowCount < configCopy.preview))
				readChunk();
		}

		function readChunk()
		{
			var end = Math.min(start + configCopy.chunkSize, file.size);
			var txt = reader.readAsText(slice.call(file, start, end), config.encoding);
			if (!usingAsyncReader)
				chunkLoaded({ target: { result: txt } });	// mimic the async signature
		}

		function chunkLoaded(event)
		{
			// Very important to increment start each time before handling results
			start += configCopy.chunkSize;

			// Rejoin the line we likely just split in two by chunking the file
			aggregate += partialLine + event.target.result;
			partialLine = "";

			finishedWithEntireFile = start >= file.size;

			if (!finishedWithEntireFile)
			{
				var lastLineEnd = aggregate.lastIndexOf("\r");	// TODO: Use an auto-detected line ending?

				if (lastLineEnd == -1)
					lastLineEnd = aggregate.lastIndexOf("\n");

				if (lastLineEnd != -1)
				{
					partialLine = aggregate.substring(lastLineEnd + 1);	// skip the line ending character (TODO: Not always length 1? \r\n...)
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
			if (results && results.data)
				rowCount += results.data.length;

			var finishedIncludingPreview = finishedWithEntireFile || (configCopy.preview && rowCount >= configCopy.preview);

			if (IS_WORKER)
			{
				global.postMessage({
					results: results,
					workerId: Papa.WORKER_ID,
					finished: finishedIncludingPreview
				});
			}
			else if (isFunction(config.chunk))
			{
				config.chunk(results, self, file);
				if (paused)
					return;
				results = undefined;
			}

			if (isFunction(userComplete) && finishedIncludingPreview)
				userComplete(results);

			if (!finishedIncludingPreview && (!results || !results.meta.paused))
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

		function replaceConfig(config)
		{
			// Deep-copy the config so we can edit it; we need
			// to call the complete function if we are to ensure
			// that the last chunk callback, if any, will be called
			// BEFORE the complete function.
			configCopy = copy(config);
			userComplete = configCopy.complete;
			configCopy.complete = undefined;
			configCopy.chunkSize = parseInt(configCopy.chunkSize);	// VERY important so we don't concatenate strings!
			handle = new ParserHandle(configCopy);
			handle.streamer = this;
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
					processResults();

					// It's possbile that this line was empty and there's no row here after all
					if (_results.data.length == 0)
						return;

					_stepCounter += results.data.length;
					if (_config.preview && _stepCounter > _config.preview)
						_parser.abort();
					else
						userStep(_results, self);
				}
			};
		}

		this.parse = function(input)
		{
			if (!_config.newline)
				_config.newline = guessLineEndings(input);

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
				_config.complete(_results);
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

			if (_config.skipEmptyLines)
			{
				for (var i = 0; i < _results.data.length; i++)
					if (_results.data[i].length == 1 && _results.data[i][0] == "")
						_results.data.splice(i--, 1);
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

		function guessLineEndings(input)
		{
			input = input.substr(0, 1024*1024);	// max length 1 MB

			var r = input.split('\r');

			if (r.length == 1)
				return '\n';

			var numWithN = 0;
			for (var i = 0; i < r.length; i++)
			{
				if (r[i][0] == '\n')
					numWithN++;
			}

			return numWithN >= r.length / 2 ? '\r\n' : '\r';
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





	// The core parser implements speedy and correct CSV parsing
	function Parser(config)
	{
		// Unpack the config object
		config = config || {};
		var delim = config.delimiter;
		var newline = config.newline;
		var comments = config.comments;
		var step = config.step;
		var preview = config.preview;
		var fastMode = config.fastMode;

		// Delimiter must be valid
		if (typeof delim !== 'string'
			|| delim.length != 1
			|| Papa.BAD_DELIMITERS.indexOf(delim) > -1)
			delim = ",";

		// Comment character must be valid
		if (comments === delim)
			throw "Comment character same as delimiter";
		else if (comments === true)
			comments = "#";
		else if (typeof comments !== 'string'
			|| Papa.BAD_DELIMITERS.indexOf(comments) > -1)
			comments = false;

		// Newline must be valid: \r, \n, or \r\n
		if (newline != '\n' && newline != '\r' && newline != '\r\n')
			newline = '\n';

		// We're gonna need these at the Parser scope
		var cursor = 0;
		var aborted = false;

		this.parse = function(input)
		{
			// For some reason, in Chrome, this speeds things up (!?)
			if (typeof input !== 'string')
				throw "Input must be a string";

			// We don't need to compute these every time parse() is called,
			// but having them in a more local scope seems to perform better
			var inputLen = input.length,
				delimLen = delim.length,
				newlineLen = newline.length,
				commentsLen = comments.length;
			var stepIsFunction = typeof step === 'function';

			// Establish starting state
			cursor = 0;
			var data = [], errors = [], row = [];

			if (!input)
				return returnable();

			if (fastMode)
			{
				// Fast mode assumes there are no quoted fields in the input
				var rows = input.split(newline);
				for (var i = 0; i < rows.length; i++)
				{
					if (comments && rows[i].substr(0, commentsLen) == comments)
						continue;
					if (stepIsFunction)
					{
						data = [ rows[i].split(delim) ];
						doStep();
						if (aborted)
							return returnable();
					}
					else
						data.push(rows[i].split(delim));
					if (preview && i >= preview)
					{
						data = data.slice(0, preview);
						return returnable(true);
					}
				}
				return returnable();
			}

			var nextDelim = input.indexOf(delim, cursor);
			var nextNewline = input.indexOf(newline, cursor);

			// Parser loop
			for (;;)
			{
				// Field has opening quote
				if (input[cursor] == '"')
				{
					// Start our search for the closing quote where the cursor is
					var quoteSearch = cursor;

					// Skip the opening quote
					cursor++;

					for (;;)
					{
						// Find closing quote
						var quoteSearch = input.indexOf('"', quoteSearch+1);

						if (quoteSearch == -1)
						{
							// No closing quote... what a pity
							errors.push({
								type: "Quotes",
								code: "MissingQuotes",
								message: "Quoted field unterminated",
								row: data.length,	// row has yet to be inserted
								index: cursor
							});
							return finish();
						}

						if (quoteSearch == inputLen-1 && hasCloseQuote(input.substring(cursor, quoteSearch+1)))
						{
							// Closing quote at EOF
							row.push(input.substring(cursor, quoteSearch).replace(/""/g, '"'));
							data.push(row);
							if (stepIsFunction)
								doStep();
							return returnable();
						}

						// If this quote is escaped, it's part of the data; skip it
						if (input[quoteSearch+1] == '"')
							continue;

						if (input[quoteSearch+1] == delim && hasCloseQuote(input.substring(cursor, quoteSearch+1)))
						{
							// Closing quote followed by delimiter
							row.push(input.substring(cursor, quoteSearch).replace(/""/g, '"'));
							cursor = quoteSearch + 1 + delimLen;
							nextDelim = input.indexOf(delim, cursor);
							nextNewline = input.indexOf(newline, cursor);
							break;
						}

						if (input.substr(quoteSearch+1, newlineLen) == newline && hasCloseQuote(input.substring(cursor, quoteSearch+1)))
						{
							// Closing quote followed by newline
							row.push(input.substring(cursor, quoteSearch).replace(/""/g, '"'));
							saveRow(quoteSearch + 1 + newlineLen);

							if (stepIsFunction)
							{
								doStep();
								if (aborted)
									return returnable();
							}
							
							if (preview && data.length >= preview)
								return returnable(true);

							break;
						}
					}

					continue;
				}

				// Comment found at start of new line
				if (comments && row.length == 0 && input.substr(cursor, commentsLen) == comments)
				{
					if (nextNewline == -1)	// Comment ends at EOF
						return returnable();
					cursor = nextNewline + newlineLen;
					nextNewline = input.indexOf(newline, cursor);
					nextDelim = input.indexOf(delim, cursor);
					continue;
				}

				// Next delimiter comes before next newline, so we've reached end of field
				if (nextDelim != -1 && (nextDelim < nextNewline || nextNewline == -1))
				{
					row.push(input.substring(cursor, nextDelim));
					cursor = nextDelim + delimLen;
					nextDelim = input.indexOf(delim, cursor);
					continue;
				}

				// End of row
				if (nextNewline != -1)
				{
					row.push(input.substring(cursor, nextNewline));
					saveRow(nextNewline + newlineLen);

					if (stepIsFunction)
					{
						doStep();
						if (aborted)
							return returnable();
					}

					if (preview && data.length >= preview)
						return returnable(true);

					continue;
				}

				break;
			}


			return finish();


			// Appends the remaining input from cursor to the end into
			// row, saves the row, calls step, and returns the results.
			function finish()
			{
				row.push(input.substr(cursor));
				data.push(row);
				cursor = inputLen;	// important in case parsing is paused
				if (stepIsFunction)
					doStep();
				return returnable();
			}

			// Appends the current row to the results. It sets the cursor
			// to newCursor and finds the nextNewline. The caller should
			// take care to execute user's step function and check for
			// preview and end parsing if necessary.
			function saveRow(newCursor)
			{
				data.push(row);
				row = [];
				cursor = newCursor;
				nextNewline = input.indexOf(newline, cursor);
			}

			// Returns an object with the results, errors, and meta.
			function returnable(stopped)
			{
				return {
					data: data,
					errors: errors,
					meta: {
						delimiter: delim,
						linebreak: newline,
						aborted: aborted,
						truncated: !!stopped
					}
				};
			}

			// Executes the user's step function and resets data & errors.
			function doStep()
			{
				step(returnable());
				data = [], errors = [];
			}
		};

		// Sets the abort flag
		this.abort = function()
		{
			aborted = true;
		};

		// Gets the cursor position
		this.getCharIndex = function()
		{
			return cursor;
		};

		// hasCloseQuote determines if a field has a closing quote.
		// field should be a string without the opening quote
		// but with the closing quote (which might not actually be
		// a closing quote).
		function hasCloseQuote(field)
		{
			if (field.length == 0)
				return false;

			if (field[field.length-1] != '"')
				return false;

			if (field.length > 2)
				return field[field.length-2] != '"' || field[field.length-3] == '"';

			if (field.length > 1)
				return field[field.length-2] != '"';

			return true;
		}
	}


	// If you need to load Papa Parse asynchronously and you also need worker threads, hard-code
	// the script path here. See: https://github.com/mholt/PapaParse/issues/87#issuecomment-57885358
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

		if (config.newline != '\n'
			&& config.newline != '\r'
			&& config.newline != '\r\n')
			config.newline = DEFAULTS.newline;

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

		if (typeof config.skipEmptyLines !== 'boolean')
			config.skipEmptyLines = DEFAULTS.skipEmptyLines;

		if (typeof config.fastMode !== 'boolean')
			config.fastMode = DEFAULTS.fastMode;

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
