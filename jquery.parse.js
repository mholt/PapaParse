/*
	jQuery Parse Plugin
	v0.5.6
	https://github.com/mholt/jquery.parse
*/

(function($)
{
	"use strict";

	var defaults = {
		delimiter: ",",
		header: true,
		dynamicTyping: false
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
		opt.header = typeof opt.header === 'undefined'
						? defaults.header
						: opt.header;
		opt.dynamicTyping = typeof opt.dynamicTyping === 'undefined'
							? defaults.dynamicTyping
							: opt.dynamicTyping;

		if (opt.delimiter == '"' || opt.delimiter == "\n")
			opt.delimiter = defaults.delimiter;

		if (opt.delimiter.length > 1)
			opt.delimiter = opt.delimiter[0];

		return opt;
	}

	function Parser(input, config)
	{
		var self = this;
		var _input = input;
		var _config = config;
		var _errors = [];
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
				
				if (_state.ch == '"')
					handleQuote();
				else if (_state.inQuotes)
					inQuotes();
				else
					notInQuotes();
			}

			// Treat the last line and its last field
			saveField();
			trimEmptyLastLine();
			inspectFieldCount();

			if (_state.inQuotes)
				addError("Unescaped or mismatched quotes");

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
				line: 1,
				field: 0,
				fieldVal: "",
				ch: "",
				inQuotes: false,
				parsed: emptyParsed(config.header)
			};
		}

		function handleQuote()
		{
			var delimBefore = (_state.i > 0 && isBoundary(_input[_state.i-1]))
								|| _state.i == 0;
			var delimAfter  = (_state.i < _input.length - 1 && isBoundary(_input[_state.i+1]))
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
				addError("Unexpected quotes");
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
			{
				saveField();
			}
			else if (_state.ch == "\n")
			{
				saveField();
				newRow();
			}
			else
			{
				appendCharToField();
			}
		}

		function isBoundary(ch)
		{
			return ch == _config.delimiter || ch == "\n";
		}

		function saveField()
		{
			if (_config.header)
			{
				if (_state.line == 1)
				{
					_state.parsed.fields.push(_state.fieldVal)
				}
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
						addError("Too many fields; expected " + _state.parsed.fields.length + " fields, found extra value: '" + _state.fieldVal + "'");
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
			trimEmptyLastLine();

			if (_config.header)
			{
				inspectFieldCount();
				if (_state.line > 0)
					_state.parsed.rows.push({});
			}
			else
				_state.parsed.push([]);

			_state.line ++;
			_state.field = 0;
		}

		function tryParseFloat(num)
		{
			var isNumber = /^-?\d+(\.\d+)?$/.test(num);
			return isNumber ? parseFloat(num) : num;
		}

		function trimEmptyLastLine()
		{
			if (_config.header)
			{
				if (_state.line == 1)
				{
					if (_state.parsed.fields.length == 1
						&& _state.parsed.fields[0].length == 0)
					{
						_state.parsed.fields = [];
						_state.line --;
					}
				}
				else
				{
					var lastRow = _state.parsed.rows[_state.parsed.rows.length - 1];
					if (!lastRow[_state.parsed.fields[0]])
						_state.parsed.rows.splice(_state.parsed.rows.length - 1, 1);
				}
			}
			else
			{
				var lastRow = _state.parsed[_state.parsed.length - 1];
				if (lastRow.length == 0 || (lastRow[0].length == 0))
					_state.parsed.splice(_state.parsed.length - 1, 1);
			}
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

			if (expected != actual)
				return addError("Too few fields; expected " + expected + " fields, parsed " + actual);

			return true;
		}

		function addError(msg)
		{
			_errors.push({
				message: msg,
				line: _state.line,
				row: _config.header ? _state.parsed.rows.length - 1 : _state.parsed.length - 1,
				index: _state.i
			});

			return false;
		}

	}

})(jQuery);
