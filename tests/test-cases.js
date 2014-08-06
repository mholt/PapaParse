var RECORD_SEP = String.fromCharCode(30);
var UNIT_SEP = String.fromCharCode(31);


// Tests for Papa.parse() function (CSV to JSON)
var PARSE_TESTS = [
	{
		description: "One row",
		input: 'A,b,c',
		expected: {
			data: [['A', 'b', 'c']],
			errors: []
		}
	},
	{
		description: "Two rows",
		input: 'A,b,c\r\nd,E,f',
		expected: {
			data: [['A', 'b', 'c'], ['d', 'E', 'f']],
			errors: []
		}
	},
	{
		description: "Two rows, just \\r",
		input: 'A,b,c\rd,E,f',
		expected: {
			data: [['A', 'b', 'c'], ['d', 'E', 'f']],
			errors: []
		}
	},
	{
		description: "Two rows, just \\n",
		input: 'A,b,c\nd,E,f',
		expected: {
			data: [['A', 'b', 'c'], ['d', 'E', 'f']],
			errors: []
		}
	},
	{
		description: "Whitespace at edges of unquoted field",
		input: 'a,  b ,c',
		notes: "Extra whitespace should graciously be preserved",
		expected: {
			data: [['a', '  b ', 'c']],
			errors: []
		}
	},
	{
		description: "Quoted field",
		input: 'A,"B",C',
		expected: {
			data: [['A', 'B', 'C']],
			errors: []
		}
	},
	{
		description: "Quoted field with extra whitespace on edges",
		input: 'A," B  ",C',
		expected: {
			data: [['A', ' B  ', 'C']],
			errors: []
		}
	},
	{
		description: "Quoted field with delimiter",
		input: 'A,"B,B",C',
		expected: {
			data: [['A', 'B,B', 'C']],
			errors: []
		}
	},
	{
		description: "Quoted field with \\r\\n",
		input: 'A,"B\r\nB",C',
		expected: {
			data: [['A', 'B\r\nB', 'C']],
			errors: []
		}
	},
	{
		description: "Quoted field with \\r",
		input: 'A,"B\rB",C',
		expected: {
			data: [['A', 'B\rB', 'C']],
			errors: []
		}
	},
	{
		description: "Quoted field with \\n",
		input: 'A,"B\nB",C',
		expected: {
			data: [['A', 'B\nB', 'C']],
			errors: []
		}
	},
	{
		description: "Quoted field with escaped quotes",
		input: 'A,"B""B""B",C',
		expected: {
			data: [['A', 'B"B"B', 'C']],
			errors: []
		}
	},
	{
		description: "Quoted field with escaped quotes at boundaries",
		input: 'A,"""B""",C',
		expected: {
			data: [['A', '"B"', 'C']],
			errors: []
		}
	},
	{
		description: "Quoted field with quotes around delimiter",
		input: 'A,""",""",C',
		notes: "For a boundary to exist immediately before the quotes, we must not already be in quotes",
		expected: {
			data: [['A', '","', 'C']],
			errors: []
		}
	},
	{
		description: "Quoted field with quotes on one side of delimiter",
		input: 'A,",""",C',
		notes: "Similar to the test above but with quotes only after the delimiter",
		expected: {
			data: [['A', ',"', 'C']],
			errors: []
		}
	},
	{
		description: "Quoted field with whitespace around quotes",
		input: 'A, "B" ,C',
		notes: "This is malformed input, but it should be parsed gracefully (with errors)",
		expected: {
			data: [['A', ' "B" ', 'C']],
			errors: [
				{"type": "Quotes", "code": "UnexpectedQuotes", "message": "Unexpected quotes", "line": 1, "row": 0, "index": 3},
				{"type": "Quotes", "code": "UnexpectedQuotes", "message": "Unexpected quotes", "line": 1, "row": 0, "index": 5}
			]
		}
	},
	{
		description: "Tab delimiter",
		input: 'a\tb\tc\r\nd\te\tf',
		config: { delimiter: "\t" },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Pipe delimiter",
		input: 'a|b|c\r\nd|e|f',
		config: { delimiter: "|" },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "ASCII 30 delimiter",
		input: 'a'+RECORD_SEP+'b'+RECORD_SEP+'c\r\nd'+RECORD_SEP+'e'+RECORD_SEP+'f',
		config: { delimiter: RECORD_SEP },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "ASCII 31 delimiter",
		input: 'a'+UNIT_SEP+'b'+UNIT_SEP+'c\r\nd'+UNIT_SEP+'e'+UNIT_SEP+'f',
		config: { delimiter: UNIT_SEP },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Bad delimiter",
		input: 'a,b,c',
		config: { delimiter: "DELIM" },
		notes: "Should silently default to comma",
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		description: "Commented line at beginning (comments: true)",
		input: '# Comment!\r\na,b,c',
		config: { comments: true },
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		description: "Commented line in middle (comments: true)",
		input: 'a,b,c\r\n# Comment\r\nd,e,f',
		config: { comments: true },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Commented line at end (comments: true)",
		input: 'a,b,c\r\n# Comment',
		config: { comments: true },
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		description: "Comment with non-default character (comments: '!')",
		input: 'a,b,c\r\n!Comment goes here\r\nd,e,f',
		config: { comments: '!' },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Comment, but bad char specified (comments: \"=N(\")",
		input: 'a,b,c\r\n=N(Comment)\r\nd,e,f',
		config: { comments: '=N(' },
		notes: "Should silently disable comment parsing",
		expected: {
			data: [['a', 'b', 'c'], ['=N(Comment)'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Input with only a commented line (comments: true)",
		input: '#commented line\r\n',
		config: { comments: true, delimiter: ',' },
		expected: {
			data: [],
			errors: []
		}
	},
	{
		description: "Input with comment without comments enabled",
		input: '#commented line',
		config: { delimiter: ',' },
		expected: {
			data: [['#commented line']],
			errors: []
		}
	},
	{
		description: "Input without comments with line starting with whitespace",
		input: 'a\r\n b\r\nc',
		config: { delimiter: ',' },
		notes: "\" \" == false, but \" \" !== false, so === comparison is required",
		expected: {
			data: [['a'], [' b'], ['c']],
			errors: []
		}
	},
	{
		description: "Comment char same as delimiter",
		input: 'a#b#c\r\n# Comment',
		config: { delimiter: '#', comments: '#' },
		notes: "Comment parsing should automatically be silently disabled in this case",
		expected: {
			data: [['a', 'b', 'c'], ['', ' Comment']],
			errors: []
		}
	},
	{
		description: "Blank line at beginning",
		input: '\r\na,b,c\r\nd,e,f',
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Blank line in middle",
		input: 'a,b,c\r\n\r\nd,e,f',
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Blank lines at end",
		input: 'a,b,c\r\nd,e,f\r\n\r\n',
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Blank line in middle with whitespace",
		input: 'a,b,c\r\n \r\nd,e,f',
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "First field of a line is empty",
		input: 'a,b,c\r\n,e,f',
		expected: {
			data: [['a', 'b', 'c'], ['', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Last field of a line is empty",
		input: 'a,b,\r\nd,e,f',
		expected: {
			data: [['a', 'b', ''], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Other fields are empty",
		input: 'a,,c\r\n,,',
		expected: {
			data: [['a', '', 'c'], ['', '', '']],
			errors: []
		}
	},
	{
		description: "Empty input string",
		input: '',
		expected: {
			data: [],
			errors: [{
				"type": "Delimiter",
				"code": "UndetectableDelimiter",
				"message": "Unable to auto-detect delimiting character; defaulted to comma"
			}]
		}
	},
	{
		description: "Input is just the delimiter (2 empty fields)",
		input: ',',
		expected: {
			data: [['', '']],
			errors: []
		}
	},
	{
		description: "Input is just a string (a single field)",
		input: 'Abc def',
		expected: {
			data: [['Abc def']],
			errors: [
				{
					"type": "Delimiter",
					"code": "UndetectableDelimiter",
					"message": "Unable to auto-detect delimiting character; defaulted to comma"
				}
			]
		}
	},
	{
		description: "Preview 0 rows should default to parsing all",
		input: 'a,b,c\r\nd,e,f\r\ng,h,i',
		config: { preview: 0 },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']],
			errors: []
		}
	},
	{
		description: "Preview 1 row",
		input: 'a,b,c\r\nd,e,f\r\ng,h,i',
		config: { preview: 1 },
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		description: "Preview 2 rows",
		input: 'a,b,c\r\nd,e,f\r\ng,h,i',
		config: { preview: 2 },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Preview all (3) rows",
		input: 'a,b,c\r\nd,e,f\r\ng,h,i',
		config: { preview: 3 },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']],
			errors: []
		}
	},
	{
		description: "Preview more rows than input has",
		input: 'a,b,c\r\nd,e,f\r\ng,h,i',
		config: { preview: 4 },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']],
			errors: []
		}
	},
	{
		description: "Preview should count rows, not lines",
		input: 'a,b,c\r\nd,e,"f\r\nf",g,h,i',
		config: { preview: 2 },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f\r\nf', 'g', 'h', 'i']],
			errors: []
		}
	},
	{
		description: "Keep empty rows",
		input: 'a,b,c\r\n\r\nd,e,f',
		config: { keepEmptyRows: true },
		expected: {
			data: [['a', 'b', 'c'], [], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Keep empty rows, with newline at end of input",
		input: 'a,b,c\r\n\r\nd,e,f\r\n',
		config: { keepEmptyRows: true },
		expected: {
			data: [['a', 'b', 'c'], [], ['d', 'e', 'f'], []],
			errors: []
		}
	},
	{
		description: "Keep empty rows, with empty input",
		input: '',
		config: { keepEmptyRows: true },
		expected: {
			data: [[]],
			errors: [
				{
					"type": "Delimiter",
					"code": "UndetectableDelimiter",
					"message": "Unable to auto-detect delimiting character; defaulted to comma"
				}
			]
		}
	},
	{
		description: "Keep empty rows, with first line only whitespace empty",
		notes: "Even with keepEmptyRows enabled, rows with just a single field,<br>being whitespace, should be stripped of that field",
		input: ' \r\na,b,c',
		config: { keepEmptyRows: true },
		expected: {
			data: [[], ['a', 'b', 'c']],
			errors: []
		}
	}
];

var PARSE_ASYNC_TESTS = [
	{
		description: "Simple worker",
		input: "A,B,C\nX,Y,Z",
		config: {
			worker: true,
		},
		expected: {
			data: [['A','B','C'],['X','Y','Z']],
			errors: []
		}
	}

	// These tests aren't applicable to BabyParse
	/*,
	{
		description: "Simple download",
		input: "/tests/sample.csv",
		config: {
			download: true
		},
		expected: {
			data: [['A','B','C'],['X','Y','Z']],
			errors: []
		}
	},
	{
		description: "Simple download + worker",
		input: "/tests/sample.csv",
		config: {
			worker: true,
			download: true
		},
		expected: {
			data: [['A','B','C'],['X','Y','Z']],
			errors: []
		}
	}*/
];








// Tests for Papa.unparse() function (JSON to CSV)
var UNPARSE_TESTS = [
	{
		description: "A simple row",
		notes: "Comma should be default delimiter",
		input: [['A', 'b', 'c']],
		expected: 'A,b,c'
	},
	{
		description: "Two rows",
		input: [['A', 'b', 'c'], ['d', 'E', 'f']],
		expected: 'A,b,c\r\nd,E,f'
	},
	{
		description: "Data with quotes",
		input: [['a', '"b"', 'c'], ['"d"', 'e', 'f']],
		expected: 'a,"""b""",c\r\n"""d""",e,f'
	},
	{
		description: "Data with newlines",
		input: [['a', 'b\nb', 'c'], ['d', 'e', 'f\r\nf']],
		expected: 'a,"b\nb",c\r\nd,e,"f\r\nf"'
	},
	{
		description: "Array of objects (header row)",
		input: [{ "Col1": "a", "Col2": "b", "Col3": "c" }, { "Col1": "d", "Col2": "e", "Col3": "f" }],
		expected: 'Col1,Col2,Col3\r\na,b,c\r\nd,e,f'
	},
	{
		description: "With header row, missing a field in a row",
		input: [{ "Col1": "a", "Col2": "b", "Col3": "c" }, { "Col1": "d", "Col3": "f" }],
		expected: 'Col1,Col2,Col3\r\na,b,c\r\nd,,f'
	},
	{
		description: "With header row, with extra field in a row",
		notes: "Extra field should be ignored; first object in array dictates header row",
		input: [{ "Col1": "a", "Col2": "b", "Col3": "c" }, { "Col1": "d", "Col2": "e", "Extra": "g", "Col3": "f" }],
		expected: 'Col1,Col2,Col3\r\na,b,c\r\nd,e,f'
	},
	{
		description: "Specifying column names and data separately",
		input: { fields: ["Col1", "Col2", "Col3"], data: [["a", "b", "c"], ["d", "e", "f"]] },
		expected: 'Col1,Col2,Col3\r\na,b,c\r\nd,e,f'
	},
	{
		description: "Specifying column names only (no data)",
		notes: "Papa should add a data property that is an empty array to prevent errors (no copy is made)",
		input: { fields: ["Col1", "Col2", "Col3"] },
		expected: 'Col1,Col2,Col3'
	},
	{
		description: "Specifying data only (no field names), improperly",
		notes: "A single array for a single row is wrong, but it can be compensated.<br>Papa should add empty fields property to prevent errors.",
		input: { data: ["abc", "d", "ef"] },
		expected: 'abc,d,ef'
	},
	{
		description: "Specifying data only (no field names), properly",
		notes: "An array of arrays, even if just a single row.<br>Papa should add empty fields property to prevent errors.",
		input: { data: [["a", "b", "c"]] },
		expected: 'a,b,c'
	},
	{
		description: "Custom delimiter (semicolon)",
		input: [['A', 'b', 'c'], ['d', 'e', 'f']],
		config: { delimiter: ';' },
		expected: 'A;b;c\r\nd;e;f'
	},
	{
		description: "Custom delimiter (tab)",
		input: [['Ab', 'cd', 'ef'], ['g', 'h', 'ij']],
		config: { delimiter: '\t' },
		expected: 'Ab\tcd\tef\r\ng\th\tij'
	},
	{
		description: "Custom delimiter (ASCII 30)",
		input: [['a', 'b', 'c'], ['d', 'e', 'f']],
		config: { delimiter: RECORD_SEP },
		expected: 'a'+RECORD_SEP+'b'+RECORD_SEP+'c\r\nd'+RECORD_SEP+'e'+RECORD_SEP+'f'
	},
	{
		description: "Bad delimiter (\\n)",
		notes: "Should default to comma",
		input: [['a', 'b', 'c'], ['d', 'e', 'f']],
		config: { delimiter: '\n' },
		expected: 'a,b,c\r\nd,e,f'
	},
	{
		description: "Custom line ending (\\r)",
		input: [['a', 'b', 'c'], ['d', 'e', 'f']],
		config: { newline: '\r' },
		expected: 'a,b,c\rd,e,f'
	},
	{
		description: "Custom line ending (\\n)",
		input: [['a', 'b', 'c'], ['d', 'e', 'f']],
		config: { newline: '\n' },
		expected: 'a,b,c\nd,e,f'
	},
	{
		description: "Custom, but strange, line ending ($)",
		input: [['a', 'b', 'c'], ['d', 'e', 'f']],
		config: { newline: '$' },
		expected: 'a,b,c$d,e,f'
	},
	{
		description: "Force quotes around all fields",
		input: [['a', 'b', 'c'], ['d', 'e', 'f']],
		config: { quotes: true },
		expected: '"a","b","c"\r\n"d","e","f"'
	},
	{
		description: "Force quotes around all fields (with header row)",
		input: [{ "Col1": "a", "Col2": "b", "Col3": "c" }, { "Col1": "d", "Col2": "e", "Col3": "f" }],
		config: { quotes: true },
		expected: '"Col1","Col2","Col3"\r\n"a","b","c"\r\n"d","e","f"'
	},
	{
		description: "Force quotes around certain fields only",
		input: [['a', 'b', 'c'], ['d', 'e', 'f']],
		config: { quotes: [true, false, true] },
		expected: '"a",b,"c"\r\n"d",e,"f"'
	},
	{
		description: "Force quotes around certain fields only (with header row)",
		input: [{ "Col1": "a", "Col2": "b", "Col3": "c" }, { "Col1": "d", "Col2": "e", "Col3": "f" }],
		config: { quotes: [true, false, true] },
		expected: '"Col1",Col2,"Col3"\r\n"a",b,"c"\r\n"d",e,"f"'
	},
	{
		description: "Empty input",
		input: [],
		expected: ''
	},
	{
		description: "Mismatched field counts in rows",
		input: [['a', 'b', 'c'], ['d', 'e'], ['f']],
		expected: 'a,b,c\r\nd,e\r\nf'
	}
];
