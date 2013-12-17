/*
	jQuery Parse Plugin
	v1.1.0
	https://github.com/mholt/jquery.parse
*/

(function($)
{
	"use strict";

	$.fn.parse = function(options)
	{
		function error(name, elem, file)
		{
			if (isFunction(options.error))
				options.error({name: name}, elem, file);
		}

		var config = isDef(options.config) ? options.config : {};

		this.each(function(idx)
		{
			var supported = $(this).prop('tagName').toUpperCase() == "INPUT"
							&& $(this).attr('type') == 'file'
							&& window.FileReader;

			if (!supported)
				return true;	// continue to next input element

			// Config to be used only for this instance of parsing
			var instanceConfig = {
				delimiter: config.delimiter,
				header: config.header,
				dynamicTyping: config.dynamicTyping
			};

			if (!this.files || this.files.length == 0)
			{
				error("NoFileError", undefined, this);
				return true;	// continue to next input element
			}

			for (var i = 0; i < this.files.length; i++)
			{
				var file = this.files[i];
				if (file.type.indexOf("text") < 0)
				{
					error("TypeMismatchError", file, this);
					continue;	// continue to next file in this input element
				}

				if (isFunction(options.before))
				{
					var returned = options.before(file, this);
					
					if (typeof returned === 'object')
					{
						// update config for this file/instance only
						if (isDef(returned.delimiter))
							instanceConfig.delimiter = returned.delimiter;
						if (isDef(returned.header))
							instanceConfig.header = returned.header;
						if (isDef(returned.dynamicTyping))
							instanceConfig.dynamicTyping = returned.dynamicTyping;
					}
					else if (returned === "skip")
						continue;		// proceed to next file
					else if (returned === false)
					{
						error("AbortError", file, this);
						return false;	// aborts the `.each()` loop
					}
				}

				var reader = new FileReader();

				if (isFunction(options.error))
					reader.onerror = function() { options.error(reader.error, file, this); };

				var inputElem = this;

				reader.onload = function(event)
				{
					var text = event.target.result;
					var results = $.parse(text, instanceConfig);
					if (isFunction(options.complete))
						options.complete(results, file, inputElem, event);
				};

				reader.readAsText(file);
			}
		});

		return this;
	};

	$.parse = function(input, options)
	{
		var parser = new Parser(options);
		return parser.parse(input);
	};

	function isFunction(func)
	{
		return typeof func === 'function';
	}

	function isDef(val)
	{
		return typeof val !== 'undefined'
	}

	// Parser is the actual parsing component.
	// It is under test and does not depend on jQuery.
	// You could rip this entire function out of the plugin
	// and use it independently (with attribution).
	function Parser(config)
	{
		var self = this;
		var _input = "";
		var _config = {};
		var _state = emptyState();
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
				if (_config.preview > 0 && _state.row >= _config.preview)
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

			endRow();	// End of input is also end of the last row

			if (_state.inQuotes)
				addError("Quotes", "MissingQuotes", "Unescaped or mismatched quotes");

			return returnable();
		};

		this.setOptions = function(opt)
		{
			opt = validConfig(opt);
			_config = {
				delimiter: opt.delimiter,
				header: opt.header,
				dynamicTyping: opt.dynamicTyping,
				preview: opt.preview
			};
		};

		this.getOptions = function()
		{
			return {
				delimiter: _config.delimiter,
				header: _config.header,
				dynamicTyping: _config.dynamicTyping,
				preview: _config.preview
			};
		};

		this.setOptions(config);

		function validConfig(config)
		{
			if (typeof config.delimiter !== 'string'
				|| config.delimiter.length != 1)
				config.delimiter = _defaultConfig.delimiter;

			if (config.deimiter == '"' || config.delimiter == "\n")
				config.delimitelr = _defaultConfig.delimiter;

			if (typeof config.header !== 'boolean')
				config.header = _defaultConfig.header;
			
			if (typeof config.dynamicTyping !== 'boolean')
				config.dynamicTyping = _defaultConfig.dynamicTyping;

			if (typeof config.preview !== 'number')
				config.preview = _defaultConfig.preview;

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

		function emptyState()
		{
			return {
				i: 0,
				lineNum: 1,
				field: 0,
				fieldVal: "",
				line: "",
				ch: "",
				inQuotes: false,
				parsed: _config.header ? { fields: [], rows: [] } : [ [] ],
				errors: { length: 0 }
			};
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
				saveField();
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

		function saveField()
		{
			if (_config.header)
			{
				if (_state.lineNum == 1)
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

			if (_config.header && _state.lineNum > 0)
				_state.parsed.rows.push({});
			else
				_state.parsed.push([]);

			_state.lineNum ++;
			_state.line = "";
			_state.field = 0;
		}

		function endRow()
		{
			saveField();
			var emptyLine = trimEmptyLine();
			if (!emptyLine && _config.header)
				inspectFieldCount();
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
					actual ++;

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
				index: _state.i
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
			_state = emptyState();
			_input = input;
		}
	}

})(jQuery);
