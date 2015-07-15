var assert = chai.assert;


// Generates all tests from CORE_PARSER_TESTS in test-cases.js
describe('Core Parser Tests', function() {
	function generateTest(test) {
		(test.disabled ? it.skip : it)(test.description, function() {
			var actual = new Papa.Parser(test.config).parse(test.input);
			assert.deepEqual(JSON.stringify(actual.errors), JSON.stringify(test.expected.errors));
			assert.deepEqual(actual.data, test.expected.data);
		});
	}

	for (var i = 0; i < CORE_PARSER_TESTS.length; i++) {
		generateTest(CORE_PARSER_TESTS[i]);
	}
});


// Generates all tests from PARSE_TESTS in test-cases.js
describe('Parse Tests', function() {
	function generateTest(test) {
		(test.disabled ? it.skip : it)(test.description, function() {
			var actual = Papa.parse(test.input, test.config);
			assert.deepEqual(JSON.stringify(actual.errors), JSON.stringify(test.expected.errors));
			assert.deepEqual(actual.data, test.expected.data);
		});
	}

	for (var i = 0; i < PARSE_TESTS.length; i++) {
		generateTest(PARSE_TESTS[i]);
	}
});


// Generates all tests from PARSE_ASYNC_TESTS in test-cases.js
describe('Parse Async Tests', function() {
	function generateTest(test) {
		(test.disabled ? it.skip : it)(test.description, function(done) {
			var config = test.config;

			config.complete = function(actual) {
				assert.deepEqual(JSON.stringify(actual.errors), JSON.stringify(test.expected.errors));
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


// Generates all tests from UNPARSE_TESTS in test-cases.js
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


// Generates all tests from CUSTOM_TESTS in test-cases.js
describe('Custom Tests', function() {
	function generateTest(test) {
		(test.disabled ? it.skip : it)(test.description, function(done) {
			test.run(function (actual) {
				assert.deepEqual(JSON.stringify(actual), JSON.stringify(test.expected));
				done();
			});
		});
	}

	for (var i = 0; i < CUSTOM_TESTS.length; i++) {
		generateTest(CUSTOM_TESTS[i]);
	}
});
