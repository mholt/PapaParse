/**
	Papa Parse 3.0 alpha - core parser function
	(c) 2014 Matthew Holt.
	Not for use in production or redistribution.
	For development of Papa Parse only.
**/
function Parser(config)
{
	var self = this;
	var BYTE_ORDER_MARK = "\ufeff";
	var EMPTY = /^\s*$/;

	// Delimiters that are not allowed
	var _badDelimiters = ["\r", "\n", "\"", BYTE_ORDER_MARK];

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
	var _aborted;	// Abort flag
	var _paused;	// Pause flag

	// Unpack the config object
	config = config || {};
	_delimiter = config.delimiter;
	_comments = config.comments;
	_step = config.step;
	_callback = config.complete;
	_preview = config.preview;

	// Delimiter integrity check
	if (typeof _delimiter !== 'string'
		|| _delimiter.length != 1
		|| _badDelimiters.indexOf(_delimiter) > -1)
		_delimiter = ",";

	// Comment character integrity check
	if (_comments === true)
		_comments = "#";
	else if (typeof _comments !== 'string'
		|| _comments.length != 1
		|| _badDelimiters.indexOf(_comments) > -1
		|| _comments == _delimiter)
		_comments = false;

	// Parses delimited text input
	this.parse = function(input)
	{
		if (typeof input !== 'string')
			throw "Input must be a string";
		reset(input);
		return parserLoop();
	};

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
			if (_paused) return;
			
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
		if (_inQuotes)
			addError("Quotes", "MissingQuotes", "Unescaped or mismatched quotes");

		endRow();	// End of input is also end of the last row

		if (typeof _step !== 'function')
			return returnable();
		else if (typeof _callback === 'function')
			_callback();
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
		if (twoCharLineBreak())
		{
			nextChar();
			saveChar();
			_lineNum++;
		}
		else if (oneCharLineBreak())
			_lineNum++;
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
		if (typeof _step === 'function')
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
			_data.splice(_rowIdx, 1);
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
		return isBoundary(_i-1) || isBoundary(_i+1);
	}

	function isBoundary(i)
	{
		if (typeof i != 'number')
			i = _i;

		var ch = _input[i];

		return (i == -1 || i == _input.length)
			|| (i < _input.length
				&& i > -1
				&& (ch == _delimiter
					|| ch == "\r"
					|| ch == "\n"));
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
			lines: _lineNum
		};
	}
}