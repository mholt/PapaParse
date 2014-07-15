// TODO: Add tests for unparse:
// If fields is omitted, write a CSV string without a header row
// If delimiter is omitted, choose comma by default
// If data is omitted, do nothing... maybe if fields IS specified, write just the header row?

var RECORD_SEP = String.fromCharCode(30);
var UNIT_SEP = String.fromCharCode(31);

var TESTS = [
	{
		input: 'A,b,c',
		description: "One row",
		expected: {
			data: [['A', 'b', 'c']],
			errors: []
		}
	},
	{
		input: 'A,b,c\r\nd,E,f',
		description: "Two rows",
		expected: {
			data: [['A', 'b', 'c'], ['d', 'E', 'f']],
			errors: []
		}
	},
	{
		input: 'A,b,c\rd,E,f',
		description: "Two rows, just \\r",
		expected: {
			data: [['A', 'b', 'c'], ['d', 'E', 'f']],
			errors: []
		}
	},
	{
		input: 'A,b,c\nd,E,f',
		description: "Two rows, just \\n",
		expected: {
			data: [['A', 'b', 'c'], ['d', 'E', 'f']],
			errors: []
		}
	},
	{
		input: 'a,  b ,c',
		description: "Whitespace at edges of unquoted field",
		notes: "Extra whitespace should graciously be preserved",
		expected: {
			data: [['a', '  b ', 'c']],
			errors: []
		}
	},
	{
		input: 'A,"B",C',
		description: "Quoted field",
		expected: {
			data: [['A', 'B', 'C']],
			errors: []
		}
	},
	{
		input: 'A," B  ",C',
		description: "Quoted field with extra whitespace on edges",
		expected: {
			data: [['A', ' B  ', 'C']],
			errors: []
		}
	},
	{
		input: 'A,"B,B",C',
		description: "Quoted field with delimiter",
		expected: {
			data: [['A', 'B,B', 'C']],
			errors: []
		}
	},
	{
		input: 'A,"B\r\nB",C',
		description: "Quoted field with \\r\\n",
		expected: {
			data: [['A', 'B\r\nB', 'C']],
			errors: []
		}
	},
	{
		input: 'A,"B\rB",C',
		description: "Quoted field with \\r",
		expected: {
			data: [['A', 'B\rB', 'C']],
			errors: []
		}
	},
	{
		input: 'A,"B\nB",C',
		description: "Quoted field with \\n",
		expected: {
			data: [['A', 'B\nB', 'C']],
			errors: []
		}
	},
	{
		input: 'A,"B""B""B",C',
		description: "Quoted field with escaped quotes",
		expected: {
			data: [['A', 'B"B"B', 'C']],
			errors: []
		}
	},
	{
		input: 'A,"""B""",C',
		description: "Quoted field with escaped quotes at boundaries",
		expected: {
			data: [['A', '"B"', 'C']],
			errors: []
		}
	},
	{
		input: 'A, "B" ,C',
		description: "Quoted field with whitespace around quotes",
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
		input: 'a\tb\tc\r\nd\te\tf',
		config: { delimiter: "\t" },
		description: "Tab delimiter",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		input: 'a|b|c\r\nd|e|f',
		config: { delimiter: "|" },
		description: "Pipe delimiter",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		input: 'a'+RECORD_SEP+'b'+RECORD_SEP+'c\r\nd'+RECORD_SEP+'e'+RECORD_SEP+'f',
		config: { delimiter: RECORD_SEP },
		description: "ASCII 30 delimiter",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		input: 'a'+UNIT_SEP+'b'+UNIT_SEP+'c\r\nd'+UNIT_SEP+'e'+UNIT_SEP+'f',
		config: { delimiter: UNIT_SEP },
		description: "ASCII 31 delimiter",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		input: 'a,b,c',
		config: { delimiter: "DELIM" },
		description: "Bad delimiter",
		notes: "Should silently default to comma",
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		input: '# Comment!\r\na,b,c',
		config: { comments: true },
		description: "Commented line at beginning (comments: true)",
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		input: 'a,b,c\r\n# Comment\r\nd,e,f',
		config: { comments: true },
		description: "Commented line in middle (comments: true)",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		input: 'a,b,c\r\n# Comment',
		config: { comments: true },
		description: "Commented line at end (comments: true)",
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		input: 'a,b,c\r\n!Comment goes here\r\nd,e,f',
		config: { comments: '!' },
		description: "Comment with non-default character (comments: '!')",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		input: 'a,b,c\r\n=N(Comment)\r\nd,e,f',
		config: { comments: '=N(' },
		description: "Comment, but bad char specified (comments: \"=N(\")",
		notes: "Should silently disable comment parsing",
		expected: {
			data: [['a', 'b', 'c'], ['=N(Comment)'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		input: '#commented line\r\n',
		config: { comments: true, delimiter: ',' },
		description: "Input with only a commented line (comments: true)",
		expected: {
			data: [],
			errors: []
		}
	},
	{
		input: '#commented line',
		config: { delimiter: ',' },
		description: "Input with comment without comments enabled",
		expected: {
			data: [['#commented line']],
			errors: []
		}
	},
	{
		input: 'a\r\n b\r\nc',
		config: { delimiter: ',' },
		description: "Input without comments with line starting with whitespace",
		notes: "\" \" == false, but \" \" !== false, so === comparison is required",
		expected: {
			data: [['a'], [' b'], ['c']],
			errors: []
		}
	},
	{
		input: 'a#b#c\r\n# Comment',
		config: { delimiter: '#', comments: '#' },
		description: "Comment char same as delimiter",
		notes: "Comment parsing should automatically be silently disabled in this case",
		expected: {
			data: [['a', 'b', 'c'], ['', ' Comment']],
			errors: []
		}
	},
	{
		input: '\r\na,b,c\r\nd,e,f',
		description: "Blank line at beginning",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		input: 'a,b,c\r\n\r\nd,e,f',
		description: "Blank line in middle",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		input: 'a,b,c\r\nd,e,f\r\n\r\n',
		description: "Blank lines at end",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		input: 'a,b,c\r\n \r\nd,e,f',
		description: "Blank line in middle with whitespace",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		input: 'a,b,c\r\n,e,f',
		description: "First field of a line is empty",
		expected: {
			data: [['a', 'b', 'c'], ['', 'e', 'f']],
			errors: []
		}
	},
	{
		input: 'a,b,c\r\n,e,f',
		description: "First field of a line is empty",
		expected: {
			data: [['a', 'b', 'c'], ['', 'e', 'f']],
			errors: []
		}
	},
	{
		input: 'a,,c\r\n,,',
		description: "Other fields are empty",
		expected: {
			data: [['a', '', 'c'], ['', '', '']],
			errors: []
		}
	},
	{
		input: '',
		description: "Empty input string",
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
		input: ',',
		description: "Input is just the delimiter (2 empty fields)",
		expected: {
			data: [['', '']],
			errors: []
		}
	},
	{
		input: 'Abc def',
		description: "Input is just a string (a single field)",
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
		input: 'a,b,c\r\nd,e,f\r\ng,h,i',
		config: { preview: 0 },
		description: "Preview 0 rows should default to parsing all",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']],
			errors: []
		}
	},
	{
		input: 'a,b,c\r\nd,e,f\r\ng,h,i',
		config: { preview: 1 },
		description: "Preview 1 row",
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		input: 'a,b,c\r\nd,e,f\r\ng,h,i',
		config: { preview: 2 },
		description: "Preview 2 rows",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		input: 'a,b,c\r\nd,e,f\r\ng,h,i',
		config: { preview: 3 },
		description: "Preview all (3) rows",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']],
			errors: []
		}
	},
	{
		input: 'a,b,c\r\nd,e,f\r\ng,h,i',
		config: { preview: 4 },
		description: "Preview more rows than input has",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']],
			errors: []
		}
	},
	{
		input: 'a,b,c\r\nd,e,"f\r\nf",g,h,i',
		config: { preview: 2 },
		description: "Preview should count rows, not lines",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f\r\nf', 'g', 'h', 'i']],
			errors: []
		}
	}
];