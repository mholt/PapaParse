module.exports = JsonToCsv;

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
		if (typeof str === "undefined")
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
