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

