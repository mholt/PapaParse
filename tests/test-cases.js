var chai;
var Papa;
if (typeof module !== 'undefined' && module.exports) {
	chai = require('chai');
	Papa = require('../papaparse.js');
}

var assert = chai.assert;

var BASE_PATH = (typeof document === 'undefined') ? './' : document.getElementById('test-cases').src.replace(/test-cases\.js$/, '');
var RECORD_SEP = String.fromCharCode(30);
var UNIT_SEP = String.fromCharCode(31);
var FILES_ENABLED = false;
try {
	new File([""], ""); // eslint-disable-line no-new
	FILES_ENABLED = true;
} catch (e) {} // safari, ie

var XHR_ENABLED = false;
try {
	new XMLHttpRequest(); // eslint-disable-line no-new
	XHR_ENABLED = true;
} catch (e) {} // safari, ie

// Tests for the core parser using new Papa.Parser().parse() (CSV to JSON)
var CORE_PARSER_TESTS = [
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
		input: 'A,b,c\nd,E,f',
		expected: {
			data: [['A', 'b', 'c'], ['d', 'E', 'f']],
			errors: []
		}
	},
	{
		description: "Three rows",
		input: 'A,b,c\nd,E,f\nG,h,i',
		expected: {
			data: [['A', 'b', 'c'], ['d', 'E', 'f'], ['G', 'h', 'i']],
			errors: []
		}
	},
	{
		description: "Whitespace at edges of unquoted field",
		input: 'a,	b ,c',
		notes: "Extra whitespace should graciously be preserved",
		expected: {
			data: [['a', '	b ', 'c']],
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
		description: "Quoted field with line break",
		input: 'A,"B\nB",C',
		expected: {
			data: [['A', 'B\nB', 'C']],
			errors: []
		}
	},
	{
		description: "Quoted fields with line breaks",
		input: 'A,"B\nB","C\nC\nC"',
		expected: {
			data: [['A', 'B\nB', 'C\nC\nC']],
			errors: []
		}
	},
	{
		description: "Quoted fields at end of row with delimiter and line break",
		input: 'a,b,"c,c\nc"\nd,e,f',
		expected: {
			data: [['a', 'b', 'c,c\nc'], ['d', 'e', 'f']],
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
		description: "Unquoted field with quotes at end of field",
		notes: "The quotes character is misplaced, but shouldn't generate an error or break the parser",
		input: 'A,B",C',
		expected: {
			data: [['A', 'B"', 'C']],
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
		description: "Quoted field with quotes on right side of delimiter",
		input: 'A,",""",C',
		notes: "Similar to the test above but with quotes only after the comma",
		expected: {
			data: [['A', ',"', 'C']],
			errors: []
		}
	},
	{
		description: "Quoted field with quotes on left side of delimiter",
		input: 'A,""",",C',
		notes: "Similar to the test above but with quotes only before the comma",
		expected: {
			data: [['A', '",', 'C']],
			errors: []
		}
	},
	{
		description: "Quoted field with 5 quotes in a row and a delimiter in there, too",
		input: '"1","cnonce="""",nc=""""","2"',
		notes: "Actual input reported in issue #121",
		expected: {
			data: [['1', 'cnonce="",nc=""', '2']],
			errors: []
		}
	},
	{
		description: "Quoted field with whitespace around quotes",
		input: 'A, "B" ,C',
		notes: "The quotes must be immediately adjacent to the delimiter to indicate a quoted field",
		expected: {
			data: [['A', ' "B" ', 'C']],
			errors: []
		}
	},
	{
		description: "Misplaced quotes in data, not as opening quotes",
		input: 'A,B "B",C',
		notes: "The input is technically malformed, but this syntax should not cause an error",
		expected: {
			data: [['A', 'B "B"', 'C']],
			errors: []
		}
	},
	{
		description: "Quoted field has no closing quote",
		input: 'a,"b,c\nd,e,f',
		expected: {
			data: [['a', 'b,c\nd,e,f']],
			errors: [{
				"type": "Quotes",
				"code": "MissingQuotes",
				"message": "Quoted field unterminated",
				"row": 0,
				"index": 3
			}]
		}
	},
	{
		description: "Quoted field has invalid trailing quote after delimiter with a valid closer",
		input: '"a,"b,c"\nd,e,f',
		notes: "The input is malformed, opening quotes identified, trailing quote is malformed. Trailing quote should be escaped or followed by valid new line or delimiter to be valid",
		expected: {
			data: [['a,"b,c'], ['d', 'e', 'f']],
			errors: [{
				"type": "Quotes",
				"code": "InvalidQuotes",
				"message": "Trailing quote on quoted field is malformed",
				"row": 0,
				"index": 1
			}]
		}
	},
	{
		description: "Quoted field has invalid trailing quote after delimiter",
		input: 'a,"b,"c\nd,e,f',
		notes: "The input is malformed, opening quotes identified, trailing quote is malformed. Trailing quote should be escaped or followed by valid new line or delimiter to be valid",
		expected: {
			data: [['a', 'b,"c\nd,e,f']],
			errors: [{
				"type": "Quotes",
				"code": "InvalidQuotes",
				"message": "Trailing quote on quoted field is malformed",
				"row": 0,
				"index": 3
			},
			{
				"type": "Quotes",
				"code": "MissingQuotes",
				"message": "Quoted field unterminated",
				"row": 0,
				"index": 3
			}]
		}
	},
	{
		description: "Quoted field has invalid trailing quote before delimiter",
		input: 'a,"b"c,d\ne,f,g',
		notes: "The input is malformed, opening quotes identified, trailing quote is malformed. Trailing quote should be escaped or followed by valid new line or delimiter to be valid",
		expected: {
			data: [['a', 'b"c,d\ne,f,g']],
			errors: [{
				"type": "Quotes",
				"code": "InvalidQuotes",
				"message": "Trailing quote on quoted field is malformed",
				"row": 0,
				"index": 3
			},
			{
				"type": "Quotes",
				"code": "MissingQuotes",
				"message": "Quoted field unterminated",
				"row": 0,
				"index": 3
			}]
		}
	},
	{
		description: "Quoted field has invalid trailing quote after new line",
		input: 'a,"b,c\nd"e,f,g',
		notes: "The input is malformed, opening quotes identified, trailing quote is malformed. Trailing quote should be escaped or followed by valid new line or delimiter to be valid",
		expected: {
			data: [['a', 'b,c\nd"e,f,g']],
			errors: [{
				"type": "Quotes",
				"code": "InvalidQuotes",
				"message": "Trailing quote on quoted field is malformed",
				"row": 0,
				"index": 3
			},
			{
				"type": "Quotes",
				"code": "MissingQuotes",
				"message": "Quoted field unterminated",
				"row": 0,
				"index": 3
			}]
		}
	},
	{
		description: "Quoted field has valid trailing quote via delimiter",
		input: 'a,"b",c\nd,e,f',
		notes: "Trailing quote is valid due to trailing delimiter",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Quoted field has valid trailing quote via \\n",
		input: 'a,b,"c"\nd,e,f',
		notes: "Trailing quote is valid due to trailing new line delimiter",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Quoted field has valid trailing quote via EOF",
		input: 'a,b,c\nd,e,"f"',
		notes: "Trailing quote is valid due to EOF",
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Quoted field contains delimiters and \\n with valid trailing quote",
		input: 'a,"b,c\nd,e,f"',
		notes: "Trailing quote is valid due to trailing delimiter",
		expected: {
			data: [['a', 'b,c\nd,e,f']],
			errors: []
		}
	},
	{
		description: "Line starts with quoted field",
		input: 'a,b,c\n"d",e,f',
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Line starts with unquoted empty field",
		input: ',b,c\n"d",e,f',
		expected: {
			data: [['', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Line ends with quoted field",
		input: 'a,b,c\nd,e,f\n"g","h","i"\n"j","k","l"',
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i'], ['j', 'k', 'l']],
			errors: []
		}
	},
	{
		description: "Line ends with quoted field, first field of next line is empty, \\n",
		input: 'a,b,c\n,e,f\n,"h","i"\n,"k","l"',
		config: {
			newline: '\n',
		},
		expected: {
			data: [['a', 'b', 'c'], ['', 'e', 'f'], ['', 'h', 'i'], ['', 'k', 'l']],
			errors: []
		}
	},
	{
		description: "Quoted field at end of row (but not at EOF) has quotes",
		input: 'a,b,"c""c"""\nd,e,f',
		expected: {
			data: [['a', 'b', 'c"c"'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Empty quoted field at EOF is empty",
		input: 'a,b,""\na,b,""',
		expected: {
			data: [['a', 'b', ''], ['a', 'b', '']],
			errors: []
		}
	},
	{
		description: "Multiple consecutive empty fields",
		input: 'a,b,,,c,d\n,,e,,,f',
		expected: {
			data: [['a', 'b', '', '', 'c', 'd'], ['', '', 'e', '', '', 'f']],
			errors: []
		}
	},
	{
		description: "Empty input string",
		input: '',
		expected: {
			data: [],
			errors: []
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
		description: "Input is just empty fields",
		input: ',,\n,,,',
		expected: {
			data: [['', '', ''], ['', '', '', '']],
			errors: []
		}
	},
	{
		description: "Input is just a string (a single field)",
		input: 'Abc def',
		expected: {
			data: [['Abc def']],
			errors: []
		}
	},
	{
		description: "Commented line at beginning",
		input: '# Comment!\na,b,c',
		config: { comments: true },
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		description: "Commented line in middle",
		input: 'a,b,c\n# Comment\nd,e,f',
		config: { comments: true },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Commented line at end",
		input: 'a,true,false\n# Comment',
		config: { comments: true },
		expected: {
			data: [['a', 'true', 'false']],
			errors: []
		}
	},
	{
		description: "Two comment lines consecutively",
		input: 'a,b,c\n#comment1\n#comment2\nd,e,f',
		config: { comments: true },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Two comment lines consecutively at end of file",
		input: 'a,b,c\n#comment1\n#comment2',
		config: { comments: true },
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		description: "Three comment lines consecutively at beginning of file",
		input: '#comment1\n#comment2\n#comment3\na,b,c',
		config: { comments: true },
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		description: "Entire file is comment lines",
		input: '#comment1\n#comment2\n#comment3',
		config: { comments: true },
		expected: {
			data: [],
			errors: []
		}
	},
	{
		description: "Comment with non-default character",
		input: 'a,b,c\n!Comment goes here\nd,e,f',
		config: { comments: '!' },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Bad comments value specified",
		notes: "Should silently disable comment parsing",
		input: 'a,b,c\n5comment\nd,e,f',
		config: { comments: 5 },
		expected: {
			data: [['a', 'b', 'c'], ['5comment'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Multi-character comment string",
		input: 'a,b,c\n=N(Comment)\nd,e,f',
		config: { comments: "=N(" },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Input with only a commented line",
		input: '#commented line',
		config: { comments: true, delimiter: ',' },
		expected: {
			data: [],
			errors: []
		}
	},
	{
		description: "Input with only a commented line and blank line after",
		input: '#commented line\n',
		config: { comments: true, delimiter: ',' },
		expected: {
			data: [['']],
			errors: []
		}
	},
	{
		description: "Input with only a commented line, without comments enabled",
		input: '#commented line',
		config: { delimiter: ',' },
		expected: {
			data: [['#commented line']],
			errors: []
		}
	},
	{
		description: "Input without comments with line starting with whitespace",
		input: 'a\n b\nc',
		config: { delimiter: ',' },
		notes: "\" \" == false, but \" \" !== false, so === comparison is required",
		expected: {
			data: [['a'], [' b'], ['c']],
			errors: []
		}
	},
	{
		description: "Multiple rows, one column (no delimiter found)",
		input: 'a\nb\nc\nd\ne',
		expected: {
			data: [['a'], ['b'], ['c'], ['d'], ['e']],
			errors: []
		}
	},
	{
		description: "One column input with empty fields",
		input: 'a\nb\n\n\nc\nd\ne\n',
		expected: {
			data: [['a'], ['b'], [''], [''], ['c'], ['d'], ['e'], ['']],
			errors: []
		}
	},
	{
		description: "Fast mode, basic",
		input: 'a,b,c\nd,e,f',
		config: { fastMode: true },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Fast mode with comments",
		input: '// Commented line\na,b,c',
		config: { fastMode: true, comments: "//" },
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		description: "Fast mode with preview",
		input: 'a,b,c\nd,e,f\nh,j,i\n',
		config: { fastMode: true, preview: 2 },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Fast mode with blank line at end",
		input: 'a,b,c\n',
		config: { fastMode: true },
		expected: {
			data: [['a', 'b', 'c'], ['']],
			errors: []
		}
	}
];

describe('Core Parser Tests', function() {
	function generateTest(test) {
		(test.disabled ? it.skip : it)(test.description, function() {
			var actual = new Papa.Parser(test.config).parse(test.input);
			assert.deepEqual(actual.errors, test.expected.errors);
			assert.deepEqual(actual.data, test.expected.data);
		});
	}

	for (var i = 0; i < CORE_PARSER_TESTS.length; i++) {
		generateTest(CORE_PARSER_TESTS[i]);
	}
});



// Tests for Papa.parse() function -- high-level wrapped parser (CSV to JSON)
var PARSE_TESTS = [
	{
		description: "Two rows, just \\r",
		input: 'A,b,c\rd,E,f',
		expected: {
			data: [['A', 'b', 'c'], ['d', 'E', 'f']],
			errors: []
		}
	},
	{
		description: "Two rows, \\r\\n",
		input: 'A,b,c\r\nd,E,f',
		expected: {
			data: [['A', 'b', 'c'], ['d', 'E', 'f']],
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
		description: "Quoted fields with spaces between closing quote and next delimiter",
		input: 'A,"B" ,C,D\r\nE,F,"G"  ,H',
		expected: {
			data: [['A', 'B', 'C','D'],['E', 'F', 'G','H']],
			errors: []
		}
	},
	{
		description: "Quoted fields with spaces between closing quote and next new line",
		input: 'A,B,C,"D" \r\nE,F,G,"H"  \r\nQ,W,E,R',
		expected: {
			data: [['A', 'B', 'C','D'],['E', 'F', 'G','H'],['Q', 'W', 'E','R']],
			errors: []
		}
	},
	{
		description: "Quoted fields with spaces after closing quote",
		input: 'A,"B" ,C,"D" \r\nE,F,"G"  ,"H"  \r\nQ,W,"E" ,R',
		expected: {
			data: [['A', 'B', 'C','D'],['E', 'F', 'G','H'],['Q', 'W', 'E','R']],
			errors: []
		}
	},
	{
		description: "Misplaced quotes in data twice, not as opening quotes",
		input: 'A,B",C\nD,E",F',
		expected: {
			data: [['A', 'B"', 'C'], ['D', 'E"', 'F']],
			errors: []
		}
	},
	{
		description: "Mixed slash n and slash r should choose first as precident",
		input: 'a,b,c\nd,e,f\rg,h,i\n',
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f\rg', 'h', 'i'], ['']],
			errors: []
		}
	},
	{
		description: "Header row with one row of data",
		input: 'A,B,C\r\na,b,c',
		config: { header: true },
		expected: {
			data: [{"A": "a", "B": "b", "C": "c"}],
			errors: []
		}
	},
	{
		description: "Header row only",
		input: 'A,B,C',
		config: { header: true },
		expected: {
			data: [],
			errors: []
		}
	},
	{
		description: "Row with too few fields",
		input: 'A,B,C\r\na,b',
		config: { header: true },
		expected: {
			data: [{"A": "a", "B": "b"}],
			errors: [{
				"type": "FieldMismatch",
				"code": "TooFewFields",
				"message": "Too few fields: expected 3 fields but parsed 2",
				"row": 0
			}]
		}
	},
	{
		description: "Row with too many fields",
		input: 'A,B,C\r\na,b,c,d,e\r\nf,g,h',
		config: { header: true },
		expected: {
			data: [{"A": "a", "B": "b", "C": "c", "__parsed_extra": ["d", "e"]}, {"A": "f", "B": "g", "C": "h"}],
			errors: [{
				"type": "FieldMismatch",
				"code": "TooManyFields",
				"message": "Too many fields: expected 3 fields but parsed 5",
				"row": 0
			}]
		}
	},
	{
		description: "Row with enough fields but blank field in the begining",
		input: 'A,B,C\r\n,b1,c1\r\na2,b2,c2',
		expected: {
			data: [["A", "B", "C"], ['', 'b1', 'c1'], ['a2', 'b2', 'c2']],
			errors: []
		}
	},
	{
		description: "Row with enough fields but blank field in the begining using headers",
		input: 'A,B,C\r\n,b1,c1\r\n,b2,c2',
		config: { header: true },
		expected: {
			data: [{"A": "", "B": "b1", "C": "c1"}, {"A": "", "B": "b2", "C": "c2"}],
			errors: []
		}
	},
	{
		description: "Row with enough fields but blank field at end",
		input: 'A,B,C\r\na,b,',
		config: { header: true },
		expected: {
			data: [{"A": "a", "B": "b", "C": ""}],
			errors: []
		}
	},
	{
		description: "Header rows are transformed when transformHeader function is provided",
		input: 'A,B,C\r\na,b,c',
		config: { header: true, transformHeader: function(header) { return header.toLowerCase(); } },
		expected: {
			data: [{"a": "a", "b": "b", "c": "c"}],
			errors: []
		}
	},
	{
		description: "transformHeader accepts and optional index attribute",
		input: 'A,B,C\r\na,b,c',
		config: { header: true, transformHeader: function(header, i) { return i % 2 ? header.toLowerCase() : header; } },
		expected: {
			data: [{"A": "a", "b": "b", "C": "c"}],
			errors: []
		}
	},
	{
		description: "Line ends with quoted field, first field of next line is empty using headers",
		input: 'a,b,"c"\r\nd,e,"f"\r\n,"h","i"\r\n,"k","l"',
		config: {
			header: true,
			newline: '\r\n',
		},
		expected: {
			data: [
				{a: 'd', b: 'e', c: 'f'},
				{a: '', b: 'h', c: 'i'},
				{a: '', b: 'k', c: 'l'}
			],
			errors: []
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
		input: 'a' + RECORD_SEP + 'b' + RECORD_SEP + 'c\r\nd' + RECORD_SEP + 'e' + RECORD_SEP + 'f',
		config: { delimiter: RECORD_SEP },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "ASCII 31 delimiter",
		input: 'a' + UNIT_SEP + 'b' + UNIT_SEP + 'c\r\nd' + UNIT_SEP + 'e' + UNIT_SEP + 'f',
		config: { delimiter: UNIT_SEP },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Bad delimiter (\\n)",
		input: 'a,b,c',
		config: { delimiter: "\n" },
		notes: "Should silently default to comma",
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		description: "Multi-character delimiter",
		input: 'a, b, c',
		config: { delimiter: ", " },
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		description: "Multi-character delimiter (length 2) with quoted field",
		input: 'a, b, "c, e", d',
		config: { delimiter: ", " },
		notes: "The quotes must be immediately adjacent to the delimiter to indicate a quoted field",
		expected: {
			data: [['a', 'b', 'c, e', 'd']],
			errors: []
		}
	},
	{
		description: "Callback delimiter",
		input: 'a$ b$ c',
		config: { delimiter: function(input) { return input[1] + ' '; } },
		expected: {
			data: [['a', 'b', 'c']],
			errors: []
		}
	},
	{
		description: "Dynamic typing converts numeric literals and maintains precision",
		input: '1,2.2,1e3\r\n-4,-4.5,-4e-5\r\n-,5a,5-2\r\n16142028098527942586,9007199254740991,-9007199254740992',
		config: { dynamicTyping: true },
		expected: {
			data: [[1, 2.2, 1000], [-4, -4.5, -0.00004], ["-", "5a", "5-2"], ["16142028098527942586", 9007199254740991, "-9007199254740992"]],
			errors: []
		}
	},
	{
		description: "Dynamic typing converts boolean literals",
		input: 'true,false,T,F,TRUE,FALSE,True,False',
		config: { dynamicTyping: true },
		expected: {
			data: [[true, false, "T", "F", true, false, "True", "False"]],
			errors: []
		}
	},
	{
		description: "Dynamic typing doesn't convert other types",
		input: 'A,B,C\r\nundefined,null,[\r\nvar,float,if',
		config: { dynamicTyping: true },
		expected: {
			data: [["A", "B", "C"], ["undefined", "null", "["], ["var", "float", "if"]],
			errors: []
		}
	},
	{
		description: "Dynamic typing applies to specific columns",
		input: 'A,B,C\r\n1,2.2,1e3\r\n-4,-4.5,-4e-5',
		config: { header: true, dynamicTyping: { A: true, C: true } },
		expected: {
			data: [{"A": 1, "B": "2.2", "C": 1000}, {"A": -4, "B": "-4.5", "C": -0.00004}],
			errors: []
		}
	},
	{
		description: "Dynamic typing applies to specific columns by index",
		input: '1,2.2,1e3\r\n-4,-4.5,-4e-5\r\n-,5a,5-2',
		config: { dynamicTyping: { 1: true } },
		expected: {
			data: [["1", 2.2, "1e3"], ["-4", -4.5, "-4e-5"], ["-", "5a", "5-2"]],
			errors: []
		}
	},
	{
		description: "Dynamic typing can be applied to `__parsed_extra`",
		input: 'A,B,C\r\n1,2.2,1e3,5.5\r\n-4,-4.5,-4e-5',
		config: { header: true, dynamicTyping: { A: true, C: true, __parsed_extra: true } },
		expected: {
			data: [{"A": 1, "B": "2.2", "C": 1000, "__parsed_extra": [5.5]}, {"A": -4, "B": "-4.5", "C": -0.00004}],
			errors: [{
				"type": "FieldMismatch",
				"code": "TooManyFields",
				"message": "Too many fields: expected 3 fields but parsed 4",
				"row": 0
			}]
		}
	},
	{
		description: "Dynamic typing by indices can be determined by function",
		input: '001,002,003',
		config: { dynamicTyping: function(field) { return (field % 2) === 0; } },
		expected: {
			data: [[1, "002", 3]],
			errors: []
		}
	},
	{
		description: "Dynamic typing by headers can be determined by function",
		input: 'A_as_int,B,C_as_int\r\n001,002,003',
		config: { header: true, dynamicTyping: function(field) { return /_as_int$/.test(field); } },
		expected: {
			data: [{"A_as_int": 1, "B": "002", "C_as_int": 3}],
			errors: []
		}
	},
	{
		description: "Dynamic typing converts empty values into NULL",
		input: '1,2.2,1e3\r\n,NULL,\r\n-,5a,null',
		config: { dynamicTyping: true },
		expected: {
			data: [[1, 2.2, 1000], [null, "NULL", null], ["-", "5a", "null"]],
			errors: []
		}
	},
	{
		description: "Custom transform function is applied to values",
		input: 'A,B,C\r\nd,e,f',
		config: {
			transform: function(value) {
				return value.toLowerCase();
			}
		},
		expected: {
			data: [["a","b","c"], ["d","e","f"]],
			errors: []
		}
	},
	{
		description: "Custom transform accepts column number also",
		input: 'A,B,C\r\nd,e,f',
		config: {
			transform: function(value, column) {
				if (column % 2) {
					value = value.toLowerCase();
				}
				return value;
			}
		},
		expected: {
			data: [["A","b","C"], ["d","e","f"]],
			errors: []
		}
	},
	{
		description: "Custom transform accepts header name when using header",
		input: 'A,B,C\r\nd,e,f',
		config: {
			header: true,
			transform: function(value, name) {
				if (name === 'B') {
					value = value.toUpperCase();
				}
				return value;
			}
		},
		expected: {
			data: [{'A': "d", 'B': "E", 'C': "f"}],
			errors: []
		}
	},
	{
		description: "Dynamic typing converts ISO date strings to Dates",
		input: 'ISO date,long date\r\n2018-05-04T21:08:03.269Z,Fri May 04 2018 14:08:03 GMT-0700 (PDT)\r\n2018-05-08T15:20:22.642Z,Tue May 08 2018 08:20:22 GMT-0700 (PDT)',
		config: { dynamicTyping: true },
		expected: {
			data: [["ISO date", "long date"], [new Date("2018-05-04T21:08:03.269Z"), "Fri May 04 2018 14:08:03 GMT-0700 (PDT)"], [new Date("2018-05-08T15:20:22.642Z"), "Tue May 08 2018 08:20:22 GMT-0700 (PDT)"]],
			errors: []
		}
	},
	{
		description: "Dynamic typing skips ISO date strings ocurring in other strings",
		input: 'ISO date,String with ISO date\r\n2018-05-04T21:08:03.269Z,The date is 2018-05-04T21:08:03.269Z\r\n2018-05-08T15:20:22.642Z,The date is 2018-05-08T15:20:22.642Z',
		config: { dynamicTyping: true },
		expected: {
			data: [["ISO date", "String with ISO date"], [new Date("2018-05-04T21:08:03.269Z"), "The date is 2018-05-04T21:08:03.269Z"], [new Date("2018-05-08T15:20:22.642Z"), "The date is 2018-05-08T15:20:22.642Z"]],
			errors: []
		}
	},
	{
		description: "Blank line at beginning",
		input: '\r\na,b,c\r\nd,e,f',
		config: { newline: '\r\n' },
		expected: {
			data: [[''], ['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Blank line in middle",
		input: 'a,b,c\r\n\r\nd,e,f',
		config: { newline: '\r\n' },
		expected: {
			data: [['a', 'b', 'c'], [''], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Blank lines at end",
		input: 'a,b,c\nd,e,f\n\n',
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f'], [''], ['']],
			errors: []
		}
	},
	{
		description: "Blank line in middle with whitespace",
		input: 'a,b,c\r\n \r\nd,e,f',
		expected: {
			data: [['a', 'b', 'c'], [" "], ['d', 'e', 'f']],
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
				"message": "Unable to auto-detect delimiting character; defaulted to ','"
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
					"message": "Unable to auto-detect delimiting character; defaulted to ','"
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
		description: "Preview with header row",
		notes: "Preview is defined to be number of rows of input not including header row",
		input: 'a,b,c\r\nd,e,f\r\ng,h,i\r\nj,k,l',
		config: { header: true, preview: 2 },
		expected: {
			data: [{"a": "d", "b": "e", "c": "f"}, {"a": "g", "b": "h", "c": "i"}],
			errors: []
		}
	},
	{
		description: "Empty lines",
		input: '\na,b,c\n\nd,e,f\n\n',
		config: { delimiter: ',' },
		expected: {
			data: [[''], ['a', 'b', 'c'], [''], ['d', 'e', 'f'], [''], ['']],
			errors: []
		}
	},
	{
		description: "Skip empty lines",
		input: 'a,b,c\n\nd,e,f',
		config: { skipEmptyLines: true },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Skip empty lines, with newline at end of input",
		input: 'a,b,c\r\n\r\nd,e,f\r\n',
		config: { skipEmptyLines: true },
		expected: {
			data: [['a', 'b', 'c'], ['d', 'e', 'f']],
			errors: []
		}
	},
	{
		description: "Skip empty lines, with empty input",
		input: '',
		config: { skipEmptyLines: true },
		expected: {
			data: [],
			errors: [
				{
					"type": "Delimiter",
					"code": "UndetectableDelimiter",
					"message": "Unable to auto-detect delimiting character; defaulted to ','"
				}
			]
		}
	},
	{
		description: "Skip empty lines, with first line only whitespace",
		notes: "A line must be absolutely empty to be considered empty",
		input: ' \na,b,c',
		config: { skipEmptyLines: true, delimiter: ',' },
		expected: {
			data: [[" "], ['a', 'b', 'c']],
			errors: []
		}
	},
	{
		description: "Skip empty lines while detecting delimiter",
		notes: "Parsing correctly newline-terminated short data with delimiter:auto and skipEmptyLines:true",
		input: 'a,b\n1,2\n3,4\n',
		config: { header: true, skipEmptyLines: true },
		expected: {
			data: [{'a': '1', 'b': '2'}, {'a': '3', 'b': '4'}],
			errors: []
		}
	},
	{
		description: "Lines with comments are not used when guessing the delimiter in an escaped file",
		notes: "Guessing the delimiter should work even if there are many lines of comments at the start of the file",
		input: '#1\n#2\n#3\n#4\n#5\n#6\n#7\n#8\n#9\n#10\none,"t,w,o",three\nfour,five,six',
		config: { comments: '#' },
		expected: {
			data: [['one','t,w,o','three'],['four','five','six']],
			errors: []
		}
	},
	{
		description: "Lines with comments are not used when guessing the delimiter in a non-escaped file",
		notes: "Guessing the delimiter should work even if there are many lines of comments at the start of the file",
		input: '#1\n#2\n#3\n#4\n#5\n#6\n#7\n#8\n#9\n#10\n#11\none,two,three\nfour,five,six',
		config: { comments: '#' },
		expected: {
			data: [['one','two','three'],['four','five','six']],
			errors: []
		}
	},
	{
		description: "Pipe delimiter is guessed correctly when mixed with comas",
		notes: "Guessing the delimiter should work even if there are many lines of comments at the start of the file",
		input: 'one|two,two|three\nfour|five,five|six',
		config: {},
		expected: {
			data: [['one','two,two','three'],['four','five,five','six']],
			errors: []
		}
	},
	{
		description: "Pipe delimiter is guessed correctly choose avgFildCount max one",
		notes: "Guessing the delimiter should work choose the min delta one and the max one",
		config: {},
		input: 'a,b,c\na,b,c|d|e|f',
		expected: {
			data: [['a', 'b', 'c'], ['a','b','c|d|e|f']],
			errors: []
		}
	},
	{
		description: "Pipe delimiter is guessed correctly when first field are enclosed in quotes and contain delimiter characters",
		notes: "Guessing the delimiter should work if the first field is enclosed in quotes, but others are not",
		input: '"Field1,1,1";Field2;"Field3";Field4;Field5;Field6',
		config: {},
		expected: {
			data: [['Field1,1,1','Field2','Field3', 'Field4', 'Field5', 'Field6']],
			errors: []
		}
	},
	{
		description: "Pipe delimiter is guessed correctly when some fields are enclosed in quotes and contain delimiter characters and escaoped quotes",
		notes: "Guessing the delimiter should work even if the first field is not enclosed in quotes, but others are",
		input: 'Field1;Field2;"Field,3,""3,3";Field4;Field5;"Field6,6"',
		config: {},
		expected: {
			data: [['Field1','Field2','Field,3,"3,3', 'Field4', 'Field5', 'Field6,6']],
			errors: []
		}
	},
	{
		description: "Single quote as quote character",
		notes: "Must parse correctly when single quote is specified as a quote character",
		input: "a,b,'c,d'",
		config: { quoteChar: "'" },
		expected: {
			data: [['a', 'b', 'c,d']],
			errors: []
		}
	},
	{
		description: "Custom escape character in the middle",
		notes: "Must parse correctly if the backslash sign (\\) is configured as a custom escape character",
		input: 'a,b,"c\\"d\\"f"',
		config: { escapeChar: '\\' },
		expected: {
			data: [['a', 'b', 'c"d"f']],
			errors: []
		}
	},
	{
		description: "Custom escape character at the end",
		notes: "Must parse correctly if the backslash sign (\\) is configured as a custom escape character and the escaped quote character appears at the end of the column",
		input: 'a,b,"c\\"d\\""',
		config: { escapeChar: '\\' },
		expected: {
			data: [['a', 'b', 'c"d"']],
			errors: []
		}
	},
	{
		description: "Custom escape character not used for escaping",
		notes: "Must parse correctly if the backslash sign (\\) is configured as a custom escape character and appears as regular character in the text",
		input: 'a,b,"c\\d"',
		config: { escapeChar: '\\' },
		expected: {
			data: [['a', 'b', 'c\\d']],
			errors: []
		}
	},
	{
		description: "Header row with preceding comment",
		notes: "Must parse correctly headers if they are preceded by comments",
		input: '#Comment\na,b\nc,d\n',
		config: { header: true, comments: '#', skipEmptyLines: true, delimiter: ',' },
		expected: {
			data: [{'a': 'c', 'b': 'd'}],
			errors: []
		}
	},
	{
		description: "Carriage return in header inside quotes, with line feed endings",
		input: '"a\r\na","b"\n"c","d"\n"e","f"\n"g","h"\n"i","j"',
		config: {},
		expected: {
			data: [['a\r\na', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j']],
			errors: []
		}
	},
	{
		description: "Line feed in header inside quotes, with carriage return + line feed endings",
		input: '"a\na","b"\r\n"c","d"\r\n"e","f"\r\n"g","h"\r\n"i","j"',
		config: {},
		expected: {
			data: [['a\na', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j']],
			errors: []
		}
	},
	{
		description: "Using \\r\\n endings uses \\r\\n linebreak",
		input: 'a,b\r\nc,d\r\ne,f\r\ng,h\r\ni,j',
		config: {},
		expected: {
			data: [['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j']],
			errors: [],
			meta: {
				linebreak: '\r\n',
				delimiter: ',',
				cursor: 23,
				aborted: false,
				truncated: false
			}
		}
	},
	{
		description: "Using \\n endings uses \\n linebreak",
		input: 'a,b\nc,d\ne,f\ng,h\ni,j',
		config: {},
		expected: {
			data: [['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j']],
			errors: [],
			meta: {
				linebreak: '\n',
				delimiter: ',',
				cursor: 19,
				aborted: false,
				truncated: false
			}
		}
	},
	{
		description: "Using \\r\\n endings with \\r\\n in header field uses \\r\\n linebreak",
		input: '"a\r\na",b\r\nc,d\r\ne,f\r\ng,h\r\ni,j',
		config: {},
		expected: {
			data: [['a\r\na', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j']],
			errors: [],
			meta: {
				linebreak: '\r\n',
				delimiter: ',',
				cursor: 28,
				aborted: false,
				truncated: false
			}
		}
	},
	{
		description: "Using \\r\\n endings with \\n in header field uses \\r\\n linebreak",
		input: '"a\na",b\r\nc,d\r\ne,f\r\ng,h\r\ni,j',
		config: {},
		expected: {
			data: [['a\na', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j']],
			errors: [],
			meta: {
				linebreak: '\r\n',
				delimiter: ',',
				cursor: 27,
				aborted: false,
				truncated: false
			}
		}
	},
	{
		description: "Using \\r\\n endings with \\n in header field with skip empty lines uses \\r\\n linebreak",
		input: '"a\na",b\r\nc,d\r\ne,f\r\ng,h\r\ni,j\r\n',
		config: {skipEmptyLines: true},
		expected: {
			data: [['a\na', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j']],
			errors: [],
			meta: {
				linebreak: '\r\n',
				delimiter: ',',
				cursor: 29,
				aborted: false,
				truncated: false
			}
		}
	},
	{
		description: "Using \\n endings with \\r\\n in header field uses \\n linebreak",
		input: '"a\r\na",b\nc,d\ne,f\ng,h\ni,j',
		config: {},
		expected: {
			data: [['a\r\na', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j']],
			errors: [],
			meta: {
				linebreak: '\n',
				delimiter: ',',
				cursor: 24,
				aborted: false,
				truncated: false
			}
		}
	},
	{
		description: "Using reserved regex character . as quote character",
		input: '.a\na.,b\r\nc,d\r\ne,f\r\ng,h\r\ni,j',
		config: { quoteChar: '.' },
		expected: {
			data: [['a\na', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j']],
			errors: [],
			meta: {
				linebreak: '\r\n',
				delimiter: ',',
				cursor: 27,
				aborted: false,
				truncated: false
			}
		}
	},
	{
		description: "Using reserved regex character | as quote character",
		input: '|a\na|,b\r\nc,d\r\ne,f\r\ng,h\r\ni,j',
		config: { quoteChar: '|' },
		expected: {
			data: [['a\na', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j']],
			errors: [],
			meta: {
				linebreak: '\r\n',
				delimiter: ',',
				cursor: 27,
				aborted: false,
				truncated: false
			}
		}
	},
	{
		description: "Parsing with skipEmptyLines set to 'greedy'",
		notes: "Must parse correctly without lines with no content",
		input: 'a,b\n\n,\nc,d\n , \n""," "\n	,	\n,,,,\n',
		config: { skipEmptyLines: 'greedy' },
		expected: {
			data: [['a', 'b'], ['c', 'd']],
			errors: []
		}
	},
	{
		description: "Parsing with skipEmptyLines set to 'greedy' with quotes and delimiters as content",
		notes: "Must include lines with escaped delimiters and quotes",
		input: 'a,b\n\n,\nc,d\n" , ",","\n""" """,""""""\n\n\n',
		config: { skipEmptyLines: 'greedy' },
		expected: {
			data: [['a', 'b'], ['c', 'd'], [' , ', ','], ['" "', '""']],
			errors: []
		}
	},
	{
		description: "Quoted fields with spaces between closing quote and next delimiter and contains delimiter",
		input: 'A,",B" ,C,D\nE,F,G,H',
		expected: {
			data: [['A', ',B', 'C', 'D'],['E', 'F', 'G', 'H']],
			errors: []
		}
	},
	{
		description: "Quoted fields with spaces between closing quote and newline and contains newline",
		input: 'a,b,"c\n" \nd,e,f',
		expected: {
			data: [['a', 'b', 'c\n'], ['d', 'e', 'f']],
			errors: []
		}
	}
];

describe('Parse Tests', function() {
	function generateTest(test) {
		(test.disabled ? it.skip : it)(test.description, function() {
			var actual = Papa.parse(test.input, test.config);
			// allows for testing the meta object if present in the test
			if (test.expected.meta) {
				assert.deepEqual(actual.meta, test.expected.meta);
			}
			assert.deepEqual(actual.errors, test.expected.errors);
			assert.deepEqual(actual.data, test.expected.data);
		});
	}

	for (var i = 0; i < PARSE_TESTS.length; i++) {
		generateTest(PARSE_TESTS[i]);
	}
});



// Tests for Papa.parse() that involve asynchronous operation
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
	},
	{
		description: "Simple download",
		input: BASE_PATH + "sample.csv",
		config: {
			download: true
		},
		disabled: !XHR_ENABLED,
		expected: {
			data: [['A','B','C'],['X','Y','Z']],
			errors: []
		}
	},
	{
		description: "Simple download + worker",
		input: BASE_PATH + "sample.csv",
		config: {
			worker: true,
			download: true
		},
		disabled: !XHR_ENABLED,
		expected: {
			data: [['A','B','C'],['X','Y','Z']],
			errors: []
		}
	},
	{
		description: "Simple file",
		disabled: !FILES_ENABLED,
		input: FILES_ENABLED ? new File(["A,B,C\nX,Y,Z"], "sample.csv") : false,
		config: {
		},
		expected: {
			data: [['A','B','C'],['X','Y','Z']],
			errors: []
		}
	},
	{
		description: "Simple file + worker",
		disabled: !FILES_ENABLED,
		input: FILES_ENABLED ? new File(["A,B,C\nX,Y,Z"], "sample.csv") : false,
		config: {
			worker: true,
		},
		expected: {
			data: [['A','B','C'],['X','Y','Z']],
			errors: []
		}
	},
	{
		description: "File with a few regular and lots of empty lines",
		disabled: !FILES_ENABLED,
		input: FILES_ENABLED ? new File(["A,B,C\nX,Y,Z\n" + new Array(500000).fill(",,").join("\n")], "sample.csv") : false,
		config: {
			skipEmptyLines: "greedy"
		},
		expected: {
			data: [['A','B','C'],['X','Y','Z']],
			errors: []
		}
	},
	{
		description: "File with a few regular and lots of empty lines + worker",
		disabled: !FILES_ENABLED,
		input: FILES_ENABLED ? new File(["A,B,C\nX,Y,Z\n" + new Array(500000).fill(",,").join("\n")], "sample.csv") : false,
		config: {
			worker: true,
			skipEmptyLines: "greedy"
		},
		expected: {
			data: [['A','B','C'],['X','Y','Z']],
			errors: []
		}
	}
];

describe('Parse Async Tests', function() {
	function generateTest(test) {
		(test.disabled ? it.skip : it)(test.description, function(done) {
			var config = test.config;

			config.complete = function(actual) {
				assert.deepEqual(actual.errors, test.expected.errors);
				assert.deepEqual(actual.data, test.expected.data);
				done();
			};

			config.error = function(err) {
				throw err;
			};

			Papa.parse(test.input, config);
		});
	}

	for (var i = 0; i < PARSE_ASYNC_TESTS.length; i++) {
		generateTest(PARSE_ASYNC_TESTS[i]);
	}
});



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
		expected: 'a' + RECORD_SEP + 'b' + RECORD_SEP + 'c\r\nd' + RECORD_SEP + 'e' + RECORD_SEP + 'f'
	},
	{
		description: "Custom delimiter (Multi-character)",
		input: [['A', 'b', 'c'], ['d', 'e', 'f']],
		config: { delimiter: ', ' },
		expected: 'A, b, c\r\nd, e, f'
	},
	{
		description: "Custom delimiter (Multi-character), field contains custom delimiter",
		input: [['A', 'b', 'c'], ['d', 'e', 'f, g']],
		config: { delimiter: ', ' },
		expected: 'A, b, c\r\nd, e, "f, g"'
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
		description: "Force quotes around string fields only",
		input: [['a', 'b', 'c'], ['d', 10, true]],
		config: { quotes: function(value) { return typeof value === 'string'; } },
		expected: '"a","b","c"\r\n"d",10,true'
	},
	{
		description: "Force quotes around string fields only (with header row)",
		input: [{ "Col1": "a", "Col2": "b", "Col3": "c" }, { "Col1": "d", "Col2": 10, "Col3": true }],
		config: { quotes: function(value) { return typeof value === 'string'; } },
		expected: '"Col1","Col2","Col3"\r\n"a","b","c"\r\n"d",10,true'
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
	},
	{
		description: "JSON null is treated as empty value",
		input: [{ "Col1": "a", "Col2": null, "Col3": "c" }],
		expected: 'Col1,Col2,Col3\r\na,,c'
	},
	{
		description: "Custom quote character (single quote)",
		input: [['a,d','b','c']],
		config: { quoteChar: "'"},
		expected: "'a,d',b,c"
	},
	{
		description: "Don't print header if header:false option specified",
		input: [{"Col1": "a", "Col2": "b", "Col3": "c"}, {"Col1": "d", "Col2": "e", "Col3": "f"}],
		config: {header: false},
		expected: 'a,b,c\r\nd,e,f'
	},
	{
		description: "Date objects are exported in its ISO representation",
		input: [{date: new Date("2018-05-04T21:08:03.269Z"), "not a date": 16}, {date: new Date("Tue May 08 2018 08:20:22 GMT-0700 (PDT)"), "not a date": 32}],
		expected: 'date,not a date\r\n2018-05-04T21:08:03.269Z,16\r\n2018-05-08T15:20:22.000Z,32'
	},
	{
		description: "Returns empty rows when empty rows are passed and skipEmptyLines is false",
		input: [[null, ' '], [], ['1', '2']],
		config: {skipEmptyLines: false},
		expected: '," "\r\n\r\n1,2'
	},
	{
		description: "Returns without empty rows when skipEmptyLines is true",
		input: [[null, ' '], [], ['1', '2']],
		config: {skipEmptyLines: true},
		expected: '," "\r\n1,2'
	},
	{
		description: "Returns without rows with no content when skipEmptyLines is 'greedy'",
		input: [[null, ' '], [], ['1', '2']].concat(new Array(500000).fill(['', ''])).concat([['3', '4']]),
		config: {skipEmptyLines: 'greedy'},
		expected: '1,2\r\n3,4'
	},
	{
		description: "Returns empty rows when empty rows are passed and skipEmptyLines is false with headers",
		input: [{a: null, b: ' '}, {}, {a: '1', b: '2'}],
		config: {skipEmptyLines: false, header: true},
		expected: 'a,b\r\n," "\r\n\r\n1,2'
	},
	{
		description: "Returns without empty rows when skipEmptyLines is true with headers",
		input: [{a: null, b: ' '}, {}, {a: '1', b: '2'}],
		config: {skipEmptyLines: true, header: true},
		expected: 'a,b\r\n," "\r\n1,2'
	},
	{
		description: "Returns without rows with no content when skipEmptyLines is 'greedy' with headers",
		input: [{a: null, b: ' '}, {}, {a: '1', b: '2'}],
		config: {skipEmptyLines: 'greedy', header: true},
		expected: 'a,b\r\n1,2'
	},
	{
		description: "Column option used to manually specify keys",
		notes: "Should not throw any error when attempting to serialize key not present in object. Columns are different than keys of the first object. When an object is missing a key then the serialized value should be an empty string.",
		input: [{a: 1, b: '2'}, {}, {a: 3, d: 'd', c: 4,}],
		config: {columns: ['a', 'b', 'c']},
		expected: 'a,b,c\r\n1,2,\r\n\r\n3,,4'
	},
	{
		description: "Column option used to manually specify keys with input type object",
		notes: "Should not throw any error when attempting to serialize key not present in object. Columns are different than keys of the first object. When an object is missing a key then the serialized value should be an empty string.",
		input: { data: [{a: 1, b: '2'}, {}, {a: 3, d: 'd', c: 4,}] },
		config: {columns: ['a', 'b', 'c']},
		expected: 'a,b,c\r\n1,2,\r\n\r\n3,,4'
	},
	{
		description: "Use different escapeChar",
		input: [{a: 'foo', b: '"quoted"'}],
		config: {header: false, escapeChar: '\\'},
		expected: 'foo,"\\"quoted\\""'
	},
	{
		description: "test defeault escapeChar",
		input: [{a: 'foo', b: '"quoted"'}],
		config: {header: false},
		expected: 'foo,"""quoted"""'
	},
	{
		description: "Escape formulae",
		input: [{ "Col1": "=danger", "Col2": "@danger", "Col3": "safe" }, { "Col1": "safe=safe", "Col2": "+danger", "Col3": "-danger, danger" }, { "Col1": "'+safe", "Col2": "'@safe", "Col3": "safe, safe" }],
		config: { escapeFormulae: true },
		expected: 'Col1,Col2,Col3\r\n"\'=danger","\'@danger",safe\r\nsafe=safe,"\'+danger","\'-danger, danger"\r\n\'+safe,\'@safe,"safe, safe"'
	},
	{
		description: "Don't escape formulae by default",
		input: [{ "Col1": "=danger", "Col2": "@danger", "Col3": "safe" }, { "Col1": "safe=safe", "Col2": "+danger", "Col3": "-danger, danger" }, { "Col1": "'+safe", "Col2": "'@safe", "Col3": "safe, safe" }],
		expected: 'Col1,Col2,Col3\r\n=danger,@danger,safe\r\nsafe=safe,+danger,"-danger, danger"\r\n\'+safe,\'@safe,"safe, safe"'
	},
	{
		description: "Escape formulae with forced quotes",
		input: [{ "Col1": "=danger", "Col2": "@danger", "Col3": "safe" }, { "Col1": "safe=safe", "Col2": "+danger", "Col3": "-danger, danger" }, { "Col1": "'+safe", "Col2": "'@safe", "Col3": "safe, safe" }],
		config: { escapeFormulae: true, quotes: true },
		expected: '"Col1","Col2","Col3"\r\n"\'=danger","\'@danger","safe"\r\n"safe=safe","\'+danger","\'-danger, danger"\r\n"\'+safe","\'@safe","safe, safe"'
	},
	{
		description: "Escape formulae with single-quote quoteChar and escapeChar",
		input: [{ "Col1": "=danger", "Col2": "@danger", "Col3": "safe" }, { "Col1": "safe=safe", "Col2": "+danger", "Col3": "-danger, danger" }, { "Col1": "'+safe", "Col2": "'@safe", "Col3": "safe, safe" }],
		config: { escapeFormulae: true, quoteChar: "'", escapeChar: "'" },
		expected: 'Col1,Col2,Col3\r\n\'\'\'=danger\',\'\'\'@danger\',safe\r\nsafe=safe,\'\'\'+danger\',\'\'\'-danger, danger\'\r\n\'\'+safe,\'\'@safe,\'safe, safe\''
	},
	{
		description: "Escape formulae with single-quote quoteChar and escapeChar and forced quotes",
		input: [{ "Col1": "=danger", "Col2": "@danger", "Col3": "safe" }, { "Col1": "safe=safe", "Col2": "+danger", "Col3": "-danger, danger" }, { "Col1": "'+safe", "Col2": "'@safe", "Col3": "safe, safe" }],
		config: { escapeFormulae: true, quotes: true, quoteChar: "'", escapeChar: "'" },
		expected: '\'Col1\',\'Col2\',\'Col3\'\r\n\'\'\'=danger\',\'\'\'@danger\',\'safe\'\r\n\'safe=safe\',\'\'\'+danger\',\'\'\'-danger, danger\'\r\n\'\'\'+safe\',\'\'\'@safe\',\'safe, safe\''
	},
	// new escapeFormulae values:
	{
		description: "Escape formulae with tab and carriage-return",
		input: [{ "Col1": "\tdanger", "Col2": "\rdanger,", "Col3": "safe\t\r" }],
		config: { escapeFormulae: true },
		expected: 'Col1,Col2,Col3\r\n"\'\tdanger","\'\rdanger,","safe\t\r"'
	},
	{
		description: "Escape formulae with tab and carriage-return, with forced quotes",
		input: [{ "Col1": "	danger", "Col2": "\rdanger,", "Col3": "safe\t\r" }],
		config: { escapeFormulae: true, quotes: true },
		expected: '"Col1","Col2","Col3"\r\n"\'\tdanger","\'\rdanger,","safe\t\r"'
	},
	{
		description: "Escape formulae with tab and carriage-return, with single-quote quoteChar and escapeChar",
		input: [{ "Col1": "	danger", "Col2": "\rdanger,", "Col3": "safe, \t\r" }],
		config: { escapeFormulae: true, quoteChar: "'", escapeChar: "'" },
		expected: 'Col1,Col2,Col3\r\n\'\'\'\tdanger\',\'\'\'\rdanger,\',\'safe, \t\r\''
	},
	{
		description: "Escape formulae with tab and carriage-return, with single-quote quoteChar and escapeChar and forced quotes",
		input: [{ "Col1": "	danger", "Col2": "\rdanger,", "Col3": "safe, \t\r" }],
		config: { escapeFormulae: true, quotes: true, quoteChar: "'", escapeChar: "'" },
		expected: '\'Col1\',\'Col2\',\'Col3\'\r\n\'\'\'\tdanger\',\'\'\'\rdanger,\',\'safe, \t\r\''
	},
];

describe('Unparse Tests', function() {
	function generateTest(test) {
		(test.disabled ? it.skip : it)(test.description, function() {
			var actual;

			try {
				actual = Papa.unparse(test.input, test.config);
			} catch (e) {
				if (e instanceof Error) {
					throw e;
				}
				actual = e;
			}

			assert.strictEqual(actual, test.expected);
		});
	}

	for (var i = 0; i < UNPARSE_TESTS.length; i++) {
		generateTest(UNPARSE_TESTS[i]);
	}
});



var CUSTOM_TESTS = [
	{
		description: "Pause and resume works (Regression Test for Bug #636)",
		disabled: !XHR_ENABLED,
		timeout: 30000,
		expected: [2001, [
			["Etiam a dolor vitae est vestibulum","84","DEF"],
			["Etiam a dolor vitae est vestibulum","84","DEF"],
			["Lorem ipsum dolor sit","42","ABC"],
			["Etiam a dolor vitae est vestibulum","84","DEF"],
			["Etiam a dolor vitae est vestibulum","84"],
			["Lorem ipsum dolor sit","42","ABC"],
			["Etiam a dolor vitae est vestibulum","84","DEF"],
			["Etiam a dolor vitae est vestibulum","84","DEF"],
			["Lorem ipsum dolor sit","42","ABC"],
			["Lorem ipsum dolor sit","42"]
		], 0],
		run: function(callback) {
			var stepped = 0;
			var dataRows = [];
			var errorCount = 0;
			var output = [];
			Papa.parse(BASE_PATH + "verylong-sample.csv", {
				download: true,
				step: function(results, parser) {
					stepped++;
					if (results)
					{
						parser.pause();
						parser.resume();
						if (results.data && stepped % 200 === 0) {
							dataRows.push(results.data);
						}
					}
				},
				complete: function() {
					output.push(stepped);
					output.push(dataRows);
					output.push(errorCount);
					callback(output);
				}
			});
		}
	},
	{
		description: "Pause and resume works for chunks with NetworkStreamer",
		disabled: !XHR_ENABLED,
		timeout: 30000,
		expected: ["Etiam a dolor vitae est vestibulum", "84", "DEF"],
		run: function(callback) {
			var chunkNum = 0;
			Papa.parse(BASE_PATH + "verylong-sample.csv", {
				download: true,
				chunkSize: 1000,
				chunk: function(results, parser) {
					chunkNum++;
					parser.pause();

					if (chunkNum === 2) {
						callback(results.data[0]);
						return;
					}

					parser.resume();
				},
				complete: function() {
					callback(new Error("Should have found matched row before parsing whole file"));
				}
			});
		}
	},
	{
		description: "Pause and resume works for chunks with FileStreamer",
		disabled: !XHR_ENABLED,
		timeout: 30000,
		expected: ["Etiam a dolor vitae est vestibulum", "84", "DEF"],
		run: function(callback) {
			var chunkNum = 0;
			var xhr = new XMLHttpRequest();
			xhr.onload = function() {
				Papa.parse(new File([xhr.responseText], './verylong-sample.csv'), {
					chunkSize: 1000,
					chunk: function(results, parser) {
						chunkNum++;
						parser.pause();

						if (chunkNum === 2) {
							callback(results.data[0]);
							return;
						}

						parser.resume();
					},
					complete: function() {
						callback(new Error("Should have found matched row before parsing whole file"));
					}
				});
			};

			xhr.open("GET", BASE_PATH + "verylong-sample.csv");
			try {
				xhr.send();
			} catch (err) {
				callback(err);
				return;
			}
		}
	},
	{
		description: "Pause and resume works for chunks with StringStreamer",
		disabled: !XHR_ENABLED,
		timeout: 30000,
		// Test also with string as byte size may be diferent
		expected: ["Etiam a dolor vitae est vestibulum", "84", "DEF"],
		run: function(callback) {
			var chunkNum = 0;
			var xhr = new XMLHttpRequest();
			xhr.onload = function() {
				Papa.parse(xhr.responseText, {
					chunkSize: 1000,
					chunk: function(results, parser) {
						chunkNum++;
						parser.pause();

						if (chunkNum === 2) {
							callback(results.data[0]);
							return;
						}

						parser.resume();
					},
					complete: function() {
						callback(new Error("Should have found matched row before parsing whole file"));
					}
				});
			};

			xhr.open("GET", BASE_PATH + "verylong-sample.csv");
			try {
				xhr.send();
			} catch (err) {
				callback(err);
				return;
			}
		}
	},
	{
		description: "Complete is called with all results if neither step nor chunk is defined",
		expected: [['A', 'b', 'c'], ['d', 'E', 'f'], ['G', 'h', 'i']],
		disabled: !FILES_ENABLED,
		run: function(callback) {
			Papa.parse(new File(['A,b,c\nd,E,f\nG,h,i'], 'sample.csv'), {
				chunkSize: 3,
				complete: function(response) {
					callback(response.data);
				}
			});
		}
	},
	{
		description: "Step is called for each row",
		expected: 2,
		run: function(callback) {
			var callCount = 0;
			Papa.parse('A,b,c\nd,E,f', {
				step: function() {
					callCount++;
				},
				complete: function() {
					callback(callCount);
				}
			});
		}
	},
	{
		description: "Data is correctly parsed with steps",
		expected: [['A', 'b', 'c'], ['d', 'E', 'f']],
		run: function(callback) {
			var data = [];
			Papa.parse('A,b,c\nd,E,f', {
				step: function(results) {
					data.push(results.data);
				},
				complete: function() {
					callback(data);
				}
			});
		}
	},
	{
		description: "Data is correctly parsed with steps (headers)",
		expected: [{One: 'A', Two: 'b', Three: 'c'}, {One: 'd', Two: 'E', Three: 'f'}],
		run: function(callback) {
			var data = [];
			Papa.parse('One,Two,Three\nA,b,c\nd,E,f', {
				header: true,
				step: function(results) {
					data.push(results.data);
				},
				complete: function() {
					callback(data);
				}
			});
		}
	},
	{
		description: "Data is correctly parsed with steps and worker (headers)",
		expected: [{One: 'A', Two: 'b', Three: 'c'}, {One: 'd', Two: 'E', Three: 'f'}],
		run: function(callback) {
			var data = [];
			Papa.parse('One,Two,Three\nA,b,c\nd,E,f', {
				header: true,
				worker: true,
				step: function(results) {
					data.push(results.data);
				},
				complete: function() {
					callback(data);
				}
			});
		}
	},
	{
		description: "Data is correctly parsed with steps and worker",
		expected: [['A', 'b', 'c'], ['d', 'E', 'f']],
		run: function(callback) {
			var data = [];
			Papa.parse('A,b,c\nd,E,f', {
				worker: true,
				step: function(results) {
					data.push(results.data);
				},
				complete: function() {
					callback(data);
				}
			});
		}
	},
	{
		description: "Data is correctly parsed with steps when skipping empty lines",
		expected: [['A', 'b', 'c'], ['d', 'E', 'f']],
		run: function(callback) {
			var data = [];
			Papa.parse('A,b,c\n\nd,E,f', {
				skipEmptyLines: true,
				step: function(results) {
					data.push(results.data);
				},
				complete: function() {
					callback(data);
				}
			});
		}
	},
	{
		description: "Step is called with the contents of the row",
		expected: ['A', 'b', 'c'],
		run: function(callback) {
			Papa.parse('A,b,c', {
				step: function(response) {
					callback(response.data);
				}
			});
		}
	},
	{
		description: "Step is called with the last cursor position",
		expected: [6, 12, 17],
		run: function(callback) {
			var updates = [];
			Papa.parse('A,b,c\nd,E,f\nG,h,i', {
				step: function(response) {
					updates.push(response.meta.cursor);
				},
				complete: function() {
					callback(updates);
				}
			});
		}
	},
	{
		description: "Step exposes cursor for downloads",
		expected: [129,	287, 452, 595, 727, 865, 1031, 1209],
		disabled: !XHR_ENABLED,
		run: function(callback) {
			var updates = [];
			Papa.parse(BASE_PATH + "long-sample.csv", {
				download: true,
				step: function(response) {
					updates.push(response.meta.cursor);
				},
				complete: function() {
					callback(updates);
				}
			});
		}
	},
	{
		description: "Step exposes cursor for chunked downloads",
		expected: [129,	287, 452, 595, 727, 865, 1031, 1209],
		disabled: !XHR_ENABLED,
		run: function(callback) {
			var updates = [];
			Papa.parse(BASE_PATH + "long-sample.csv", {
				download: true,
				chunkSize: 500,
				step: function(response) {
					updates.push(response.meta.cursor);
				},
				complete: function() {
					callback(updates);
				}
			});
		}
	},
	{
		description: "Step exposes cursor for workers",
		expected: [452, 452, 452, 865, 865, 865, 1209, 1209],
		disabled: !XHR_ENABLED,
		run: function(callback) {
			var updates = [];
			Papa.parse(BASE_PATH + "long-sample.csv", {
				download: true,
				chunkSize: 500,
				worker: true,
				step: function(response) {
					updates.push(response.meta.cursor);
				},
				complete: function() {
					callback(updates);
				}
			});
		}
	},
	{
		description: "Chunk is called for each chunk",
		expected: [3, 3, 2],
		disabled: !XHR_ENABLED,
		run: function(callback) {
			var updates = [];
			Papa.parse(BASE_PATH + "long-sample.csv", {
				download: true,
				chunkSize: 500,
				chunk: function(response) {
					updates.push(response.data.length);
				},
				complete: function() {
					callback(updates);
				}
			});
		}
	},
	{
		description: "Chunk is called with cursor position",
		expected: [452, 865, 1209],
		disabled: !XHR_ENABLED,
		run: function(callback) {
			var updates = [];
			Papa.parse(BASE_PATH + "long-sample.csv", {
				download: true,
				chunkSize: 500,
				chunk: function(response) {
					updates.push(response.meta.cursor);
				},
				complete: function() {
					callback(updates);
				}
			});
		}
	},
	{
		description: "Chunk functions can pause parsing",
		expected: [
			[['A', 'b', 'c']]
		],
		run: function(callback) {
			var updates = [];
			Papa.parse('A,b,c\nd,E,f\nG,h,i', {
				chunkSize: 10,
				chunk: function(response, handle) {
					updates.push(response.data);
					handle.pause();
					callback(updates);
				},
				complete: function() {
					callback(new Error('incorrect complete callback'));
				}
			});
		}
	},
	{
		description: "Chunk functions can resume parsing",
		expected: [
			[['A', 'b', 'c']],
			[['d', 'E', 'f'], ['G', 'h', 'i']]
		],
		run: function(callback) {
			var updates = [];
			var handle = null;
			var first = true;
			Papa.parse('A,b,c\nd,E,f\nG,h,i', {
				chunkSize: 10,
				chunk: function(response, h) {
					updates.push(response.data);
					if (!first) return;
					handle = h;
					handle.pause();
					first = false;
				},
				complete: function() {
					callback(updates);
				}
			});
			setTimeout(function() {
				handle.resume();
			}, 500);
		}
	},
	{
		description: "Chunk functions can abort parsing",
		expected: [
			[['A', 'b', 'c']]
		],
		run: function(callback) {
			var updates = [];
			Papa.parse('A,b,c\nd,E,f\nG,h,i', {
				chunkSize: 1,
				chunk: function(response, handle) {
					if (response.data.length) {
						updates.push(response.data);
						handle.abort();
					}
				},
				complete: function(response) {
					callback(updates);
				}
			});
		}
	},
	{
		description: "Step exposes indexes for files",
		expected: [6, 12, 17],
		disabled: !FILES_ENABLED,
		run: function(callback) {
			var updates = [];
			Papa.parse(new File(['A,b,c\nd,E,f\nG,h,i'], 'sample.csv'), {
				download: true,
				step: function(response) {
					updates.push(response.meta.cursor);
				},
				complete: function() {
					callback(updates);
				}
			});
		}
	},
	{
		description: "Step exposes indexes for chunked files",
		expected: [6, 12, 17],
		disabled: !FILES_ENABLED,
		run: function(callback) {
			var updates = [];
			Papa.parse(new File(['A,b,c\nd,E,f\nG,h,i'], 'sample.csv'), {
				chunkSize: 3,
				step: function(response) {
					updates.push(response.meta.cursor);
				},
				complete: function() {
					callback(updates);
				}
			});
		}
	},
	{
		description: "Quoted line breaks near chunk boundaries are handled",
		expected: [['A', 'B', 'C'], ['X', 'Y\n1\n2\n3', 'Z']],
		disabled: !FILES_ENABLED,
		run: function(callback) {
			var updates = [];
			Papa.parse(new File(['A,B,C\nX,"Y\n1\n2\n3",Z'], 'sample.csv'), {
				chunkSize: 3,
				step: function(response) {
					updates.push(response.data);
				},
				complete: function() {
					callback(updates);
				}
			});
		}
	},
	{
		description: "Step functions can abort parsing",
		expected: [['A', 'b', 'c']],
		run: function(callback) {
			var updates = [];
			Papa.parse('A,b,c\nd,E,f\nG,h,i', {
				step: function(response, handle) {
					updates.push(response.data);
					handle.abort();
					callback(updates);
				},
				chunkSize: 6
			});
		}
	},
	{
		description: "Complete is called after aborting",
		expected: true,
		run: function(callback) {
			Papa.parse('A,b,c\nd,E,f\nG,h,i', {
				step: function(response, handle) {
					handle.abort();
				},
				chunkSize: 6,
				complete: function(response) {
					callback(response.meta.aborted);
				}
			});
		}
	},
	{
		description: "Step functions can pause parsing",
		expected: [['A', 'b', 'c']],
		run: function(callback) {
			var updates = [];
			Papa.parse('A,b,c\nd,E,f\nG,h,i', {
				step: function(response, handle) {
					updates.push(response.data);
					handle.pause();
					callback(updates);
				},
				complete: function() {
					callback('incorrect complete callback');
				}
			});
		}
	},
	{
		description: "Step functions can resume parsing",
		expected: [['A', 'b', 'c'], ['d', 'E', 'f'], ['G', 'h', 'i']],
		run: function(callback) {
			var updates = [];
			var handle = null;
			var first = true;
			Papa.parse('A,b,c\nd,E,f\nG,h,i', {
				step: function(response, h) {
					updates.push(response.data);
					if (!first) return;
					handle = h;
					handle.pause();
					first = false;
				},
				complete: function() {
					callback(updates);
				}
			});
			setTimeout(function() {
				handle.resume();
			}, 500);
		}
	},
	{
		description: "Step functions can abort workers",
		expected: 1,
		disabled: !XHR_ENABLED,
		run: function(callback) {
			var updates = 0;
			Papa.parse(BASE_PATH + "long-sample.csv", {
				worker: true,
				download: true,
				chunkSize: 500,
				step: function(response, handle) {
					updates++;
					handle.abort();
				},
				complete: function() {
					callback(updates);
				}
			});
		}
	},
	{
		description: "beforeFirstChunk manipulates only first chunk",
		expected: 7,
		disabled: !XHR_ENABLED,
		run: function(callback) {
			var updates = 0;
			Papa.parse(BASE_PATH + "long-sample.csv", {
				download: true,
				chunkSize: 500,
				beforeFirstChunk: function(chunk) {
					return chunk.replace(/.*?\n/, '');
				},
				step: function(response) {
					updates++;
				},
				complete: function() {
					callback(updates);
				}
			});
		}
	},
	{
		description: "First chunk not modified if beforeFirstChunk returns nothing",
		expected: 8,
		disabled: !XHR_ENABLED,
		run: function(callback) {
			var updates = 0;
			Papa.parse(BASE_PATH + "long-sample.csv", {
				download: true,
				chunkSize: 500,
				beforeFirstChunk: function(chunk) {
				},
				step: function(response) {
					updates++;
				},
				complete: function() {
					callback(updates);
				}
			});
		}
	},
	{
		description: "Should correctly guess custom delimiter when passed delimiters to guess.",
		expected: "~",
		run: function(callback) {
			var results = Papa.parse('"A"~"B"~"C"~"D"', {
				delimitersToGuess: ['~', '@', '%']
			});
			callback(results.meta.delimiter);
		}
	},
	{
		description: "Should still correctly guess default delimiters when delimiters to guess are not given.",
		expected: ",",
		run: function(callback) {
			var results = Papa.parse('"A","B","C","D"');
			callback(results.meta.delimiter);
		}
	}
];

describe('Custom Tests', function() {
	function generateTest(test) {
		(test.disabled ? it.skip : it)(test.description, function(done) {
			if(test.timeout) {
				this.timeout(test.timeout);
			}
			test.run(function(actual) {
				assert.deepEqual(actual, test.expected);
				done();
			});
		});
	}

	for (var i = 0; i < CUSTOM_TESTS.length; i++) {
		generateTest(CUSTOM_TESTS[i]);
	}
});
