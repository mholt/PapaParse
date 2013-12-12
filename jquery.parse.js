/*
	jQuery Parse Plugin
	v1.0.0
	https://github.com/mholt/jquery.parse
*/

(function($)
{
	"use strict";

	var reader = new FileReader();
	var defaults = {
		delimiter: ",",
		header: true,
		dynamicTyping: false
	};
	var config = {
		delimiter: defaults.delimiter,
		header: defaults.header,
		dynamicTyping: defaults.dynamicTyping
	};

	$.fn.parse = function(options)
	{
		function error(name, elem, file)
		{
			if (isFunction(options.error))
				options.error({name: name}, elem, file);
		}

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
		options = verifyOptions(options);
		var parser = new Parser(input, options);
		return {
			results: parser.parse(),
			errors: parser.getErrors()
		};
	};

	function verifyOptions(opt)
	{
		opt.delimiter = opt.delimiter || defaults.delimiter;
		opt.header = !isDef(opt.header) ? defaults.header : opt.header;
		opt.dynamicTyping = !isDef(opt.dynamicTyping) ? defaults.dynamicTyping : opt.dynamicTyping;

		if (opt.delimiter == '"' || opt.delimiter == "\n")
			opt.delimiter = defaults.delimiter;

		if (opt.delimiter.length > 1)
			opt.delimiter = opt.delimiter[0];

		return opt;
	}

	function isFunction(func)
	{
		return typeof func === 'function';
	}

	function isDef(val)
	{
		return typeof val !== 'undefined'
	}

	function Parser(input, config)
	{
		var self = this;
		var _input = input;
		var _config = config;
		var _errors = [];
		var _regex = {
			floats: /^\s*-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?\s*$/i,
			empty: /^\s*$/
		}
		var _state = emptyState();

		this.parse = function(arg)
		{
			if (typeof arg === 'object')
				self.setConfig(arg)
			else if (typeof arg === 'string')
				self.setInput(arg);

			_errors = [];
			_state = emptyState();

			for (_state.i = 0; _state.i < _input.length; _state.i++)
			{
				_state.ch = _input[_state.i];
				_state.line += _state.ch;
				
				if (_state.ch == '"')
					handleQuote();
				else if (_state.inQuotes)
					inQuotes();
				else
					notInQuotes();
			}

			// End of input is also end of the last row
			endRow();

			if (_state.inQuotes)
				addError("Quotes", "MissingQuotes", "Unescaped or mismatched quotes");

			return self.getParsed();
		};

		this.getDelimiter = function()
		{
			return config.delimiter;
		};

		this.setDelimiter = function(delim)
		{
			var comma = ",";
			delim = delim
				? (delim == '"' || delim == "\n" ? comma : delim)
				: comma;
			_config.delimiter = delim[0];
		};

		this.setConfig = function(opt)
		{
			if ((typeof opt.header !== 'undefined'
					&& opt.header != config.header)
				|| (typeof opt.delimiter !== 'undefined'
					&& opt.delimiter != config.delimiter))
			{
				_state.parsed = emptyParsed(opt.header);
			}

			_config = opt;

			if (typeof opt.delimiter !== 'undefined')
				self.setDelimiter(opt.delimiter);
			console.log("DELIM:", _config);
		}

		this.getInput = function()
		{
			return _input;
		}

		this.setInput = function(input)
		{
			_input = input;
		}

		this.getParsed = function()
		{
			return _state.parsed;
		}

		this.getErrors = function()
		{
			return _errors;
		}


		function emptyParsed(header)
		{
			return header ? { fields: [], rows: [] } : [ [] ]; 
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
				parsed: emptyParsed(config.header)
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
			{
				_state.inQuotes = !_state.inQuotes;
			}
			else
			{
				addError("Quotes", "UnexpectedQuotes", "Unexpected quotes");
			}
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
			else if (_state.ch == "\r" && _state.i < _input.length - 1
						&& _input[_state.i+1] == "\n")
			{
				newRow();
				_state.i++;
			}
			else if (_state.ch == "\n")
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

		function endRow()
		{
			saveField();
			var emptyLine = trimEmptyLine();
			if (!emptyLine && _config.header)
				inspectFieldCount();
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

		function addError(type, code, msg)
		{
			_errors.push({
				type: type, 
				code: code,
				message: msg,
				line: _state.lineNum,
				row: _config.header ? _state.parsed.rows.length - 1 : _state.parsed.length - 1,
				index: _state.i
			});
			return false;
		}

	}

})(jQuery);
