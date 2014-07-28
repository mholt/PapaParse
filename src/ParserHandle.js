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
