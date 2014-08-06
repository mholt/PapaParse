/*
	Baby Parse
	v0.2.1
	https://github.com/Rich-Harris/BabyParse

	based on Papa Parse v3.0.1
	https://github.com/mholt/PapaParse
*/


(function ( global ) {

	// A configuration object from which to draw default settings
	var DEFAULTS = {
		delimiter: "",	// empty: auto-detect
		header: false,
		dynamicTyping: false,
		preview: 0,
		step: undefined,
		comments: false,
		complete: undefined,
		keepEmptyRows: false
	};

	var Baby = {};
	Baby.parse = CsvToJson;
	Baby.unparse = JsonToCsv;
	Baby.RECORD_SEP = String.fromCharCode(30);
	Baby.UNIT_SEP = String.fromCharCode(31);
	Baby.BYTE_ORDER_MARK = "\ufeff";
	Baby.BAD_DELIMITERS = ["\r", "\n", "\"", Baby.BYTE_ORDER_MARK];


	function CsvToJson(_input, _config)
	{
		var config = copyAndValidateConfig(_config);
		var ph = new ParserHandle(config);
		var results = ph.parse(_input);
		if (isFunction(config.complete))
			config.complete(results);
		return results;
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
				&& Baby.BAD_DELIMITERS.indexOf(_config.delimiter) == -1)
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
							|| hasAny(str, Baby.BAD_DELIMITERS)
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
		_config = copy(_config);

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

			if (isFunction(_config.step))
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
			var delimChoices = [",", "\t", "|", ";", Baby.RECORD_SEP, Baby.UNIT_SEP];
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
		var _runningRowIdx;		// Cumulative row index, used by the preview feature
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
			|| Baby.BAD_DELIMITERS.indexOf(_delimiter) > -1)
			_delimiter = ",";

		// Comment character integrity check
		if (_comments === true)
			_comments = "#";
		else if (typeof _comments !== 'string'
			|| _comments.length != 1
			|| Baby.BAD_DELIMITERS.indexOf(_comments) > -1
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

		function parserLoop()
		{
			while (_i < _input.length)
			{
				if (_aborted) break;
				if (_preview > 0 && _runningRowIdx >= _preview) break;
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
					aborted: _aborted
				}
			};
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
			|| Baby.BAD_DELIMITERS.indexOf(config.delimiter) > -1)
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






	// export to Node...
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = Baby;
	}

	// ...or as AMD module...
	else if ( typeof define === 'function' && define.amd ) {
		define( function () { return Baby; });
	}

	// ...or as browser global
	else {
		global.Baby = Baby;
	}



}( typeof window !== 'undefined' ? window : this ));
