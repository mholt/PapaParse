/*
	Baby Parse
	v0.1.0
	https://github.com/Rich-Harris/BabyParse

	based on:

	Papa Parse
	v2.0.1
	https://github.com/mholt/jquery.parse
*/


(function ( global ) {

	function Parser(config)
	{
		var self = this;
		var _invocations = 0;
		var _input = "";
		var _chunkOffset = 0;
		var _abort = false;
		var _config = {};
		var _state = freshState();
		var _defaultConfig = {
			delimiter: "",
			header: true,
			dynamicTyping: true,
			preview: 0
		};
		var _regex = {
			floats: /^\s*-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?\s*$/i,
			empty: /^\s*$/
		};

		config = validConfig(config);
		_config = {
			delimiter: config.delimiter,
			header: config.header,
			dynamicTyping: config.dynamicTyping,
			preview: config.preview,
			step: config.step
		};

		this.parse = function(input)
		{
			if (typeof input !== 'string')
				return returnable();

			reset(input);

			if (!_config.delimiter && !guessDelimiter(input))
			{
				addError("Delimiter", "UndetectableDelimiter", "Unable to auto-detect delimiting character; defaulted to comma", "config");
				_config.delimiter = ",";
			}

			for (_state.i = 0; _state.i < _input.length; _state.i++)
			{
				if (_abort || (_config.preview > 0 && _state.lineNum > _config.preview))
					break;

				_state.ch = _input[_state.i];
				_state.line += _state.ch;

				if (_state.ch == '"')
					handleQuote();
				else if (_state.inQuotes)
					inQuotes();
				else
					notInQuotes();
			}

			if (_abort)
				addError("Abort", "ParseAbort", "Parsing was aborted by the user's step function", "abort");
			else
			{
				endRow();	// End of input is also end of the last row
				if (_state.inQuotes)
					addError("Quotes", "MissingQuotes", "Unescaped or mismatched quotes");
			}

			return returnable();
		};

		this.getOptions = function()
		{
			return {
				delimiter: _config.delimiter,
				header: _config.header,
				dynamicTyping: _config.dynamicTyping,
				preview: _config.preview,
				step: _config.step
			};
		};

		function validConfig(config)
		{
			if (typeof config !== 'object')
				config = {};

			if (typeof config.delimiter !== 'string'
				|| config.delimiter.length != 1)
				config.delimiter = _defaultConfig.delimiter;

			if (config.deimiter == '"' || config.delimiter == "\n")
				config.delimiter = _defaultConfig.delimiter;

			if (typeof config.header !== 'boolean')
				config.header = _defaultConfig.header;

			if (typeof config.dynamicTyping !== 'boolean')
				config.dynamicTyping = _defaultConfig.dynamicTyping;

			if (typeof config.preview !== 'number')
				config.preview = _defaultConfig.preview;

			if (typeof config.step !== 'function')
				config.step = _defaultConfig.step;

			return config;
		}

		function guessDelimiter(input)
		{
			var delimiters = [",", "\t", "|", ";"];
			var bestDelim, bestDelta, fieldCountPrevRow;

			for (var i in delimiters)
			{
				var delim = delimiters[i];
				var delta = 0, avgFieldCount = 0;

				var preview = new Parser({
					delimiter: delim,
					header: false,
					dynamicTyping: false,
					preview: 10
				}).parse(input);

				for (var j in preview.results)
				{
					var fieldCount = preview.results[j].length;
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

				avgFieldCount /= preview.results.length;

				if ((typeof bestDelta === 'undefined' || delta < bestDelta)
					&& avgFieldCount > 1.99)
				{
					bestDelta = delta;
					bestDelim = delim;
				}
			}

			_config.delimiter = bestDelim;

			return !!bestDelim;
		}

		function handleQuote()
		{
			var delimBefore = (_state.i > 0 && isBoundary(_state.i-1))
								|| _state.i == 0;
			var delimAfter  = (_state.i < _input.length - 1 && isBoundary(_state.i+1))
								|| _state.i == _input.length - 1;
			var escaped     = _state.i < _input.length - 1
								&& _input[_state.i+1] == '"';

			if (_state.inQuotes && escaped)
			{
				_state.fieldVal += '"';
				_state.i++;
			}
			else if (delimBefore || delimAfter)
				_state.inQuotes = !_state.inQuotes;
			else
				addError("Quotes", "UnexpectedQuotes", "Unexpected quotes");
		}

		function inQuotes()
		{
			appendCharToField();
		}

		function appendCharToField()
		{
			_state.fieldVal += _state.ch;
		}

		function notInQuotes()
		{
			if (_state.ch == _config.delimiter)
				saveValue();
			else if ((_state.ch == "\r" && _state.i < _input.length - 1
						&& _input[_state.i+1] == "\n")
					|| (_state.ch == "\n" && _state.i < _input.length - 1
						&& _input[_state.i+1] == "\r"))
			{
				newRow();
				_state.i++;
			}
			else if (_state.ch == "\n" || _state.ch == "\r")
				newRow();
			else
				appendCharToField();
		}

		function isBoundary(i)
		{
			if (i >= _input.length)
				return false;

			var ch = _input[i];

			if (ch == _config.delimiter
				|| ch == "\n"
				|| (ch == "\r" && i < _input.length - 1 && _input[i+1] == "\n"))
				return true;
			else
				return false;
		}

		function isLineEnding(i)
		{
			if (i >= _input.length)
				return false;

			if (i < _input.length - 1)
				return _input[i] == "\n" || (_input[i] == "\r" && _input[i+1] == "\n");
			else
				return _input[i] == "\n";
		}

		function saveValue()
		{
			if (_config.header)
			{
				if (_state.lineNum == 1 && _invocations == 1)
					_state.parsed.fields.push(_state.fieldVal)
				else
				{
					var currentRow = _state.parsed.rows[_state.parsed.rows.length - 1];
					var fieldName = _state.parsed.fields[_state.field];
					if (fieldName)
					{
						if (_config.dynamicTyping)
							_state.fieldVal = tryParseFloat(_state.fieldVal);
						currentRow[fieldName] = _state.fieldVal;
					}
					else
					{
						if (typeof currentRow.__parsed_extra === 'undefined')
							currentRow.__parsed_extra = [];
						currentRow.__parsed_extra.push(_state.fieldVal);
					}
				}
			}
			else
			{
				if (_config.dynamicTyping)
					_state.fieldVal = tryParseFloat(_state.fieldVal);
				_state.parsed[_state.parsed.length - 1].push(_state.fieldVal);
			}

			_state.fieldVal = "";
			_state.field ++;
		}

		function newRow()
		{
			endRow();

			if (streaming())
			{
				_state.errors = {};
				_state.errors.length = 0;
			}

			if (_config.header && _state.lineNum > 0)
			{
				if (streaming())
					_state.parsed.rows = [ {} ];
				else
					_state.parsed.rows.push({});
			}
			else
			{
				if (streaming())
					_state.parsed = [ [] ];
				else
					_state.parsed.push([]);
			}

			_state.lineNum ++;
			_state.line = "";
			_state.field = 0;
		}

		function endRow()
		{
			if (_abort)
				return;

			saveValue();

			var emptyLine = trimEmptyLine();

			if (!emptyLine && _config.header)
				inspectFieldCount();

			if (streaming() && (!_config.header ||
					(_config.header && _state.parsed.rows.length > 0)))
			{
				var keepGoing = _config.step(returnable());
				if (keepGoing === false)
					_abort = true;
			}
		}

		function streaming()
		{
			return typeof _config.step === 'function';
		}

		function tryParseFloat(num)
		{
			var isNumber = _regex.floats.test(num);
			return isNumber ? parseFloat(num) : num;
		}

		function trimEmptyLine()
		{
			if (_regex.empty.test(_state.line))
			{
				if (_config.header)
				{
					if (_state.lineNum == 1)
					{
						_state.parsed.fields = [];
						_state.lineNum --;
					}
					else
						_state.parsed.rows.splice(_state.parsed.rows.length - 1, 1);
				}
				else
					_state.parsed.splice(_state.parsed.length - 1, 1);

				return true;
			}
			return false;
		}

		function inspectFieldCount()
		{
			if (!_config.header)
				return true;

			if (_state.parsed.rows.length == 0)
				return true;

			var expected = _state.parsed.fields.length;

			// Actual field count tabulated manually because IE<9 doesn't support Object.keys
			var actual = 0;
			var lastRow = _state.parsed.rows[_state.parsed.rows.length - 1];
			for (var prop in lastRow)
				if (lastRow.hasOwnProperty(prop))
					actual++;

			if (actual < expected)
				return addError("FieldMismatch", "TooFewFields", "Too few fields: expected " + expected + " fields but parsed " + actual);
			else if (actual > expected)
				return addError("FieldMismatch", "TooManyFields", "Too many fields: expected " + expected + " fields but parsed " + actual);
			return true;
		}

		function addError(type, code, msg, errKey)
		{
			var row = _config.header
						? (_state.parsed.rows.length ? _state.parsed.rows.length - 1 : undefined)
						: _state.parsed.length - 1;
			var key = errKey || row;

			if (typeof _state.errors[key] === 'undefined')
				_state.errors[key] = [];

			_state.errors[key].push({
				type: type,
				code: code,
				message: msg,
				line: _state.lineNum,
				row: row,
				index: _state.i + _chunkOffset
			});

			_state.errors.length ++;

			return false;
		}

		function returnable()
		{
			return {
				results: _state.parsed,
				errors: _state.errors
			};
		}

		function reset(input)
		{
			_invocations++;
			if (_invocations > 1 && streaming())
				_chunkOffset += input.length;
			_state = freshState();
			_input = input;
		}

		function freshState()
		{
			// If streaming, and thus parsing the input in chunks, this
			// is careful to preserve what we've already got, when necessary.
			var parsed;
			if (_config.header)
			{
				parsed = {
					fields: streaming() ? _state.parsed.fields || [] : [],
					rows: streaming() && _invocations > 1 ? [ {} ] : []
				};
			}
			else
				parsed = [ [] ];

			return {
				i: 0,
				lineNum: streaming() ? _state.lineNum : 1,
				field: 0,
				fieldVal: "",
				line: "",
				ch: "",
				inQuotes: false,
				parsed: parsed,
				errors: { length: 0 }
			};
		}
	};

	// export to Node...
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = Parser;
	}

	// ...or as AMD module...
	else if ( typeof define === 'function' && define.amd ) {
		define( function () { return Parser; });
	}

	// ...or as browser global
	else {
		global.Parser = Parser;
	}

}( typeof window !== 'undefined' ? window : this ));
