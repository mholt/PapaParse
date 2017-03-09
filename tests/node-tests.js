(function() {
	"use strict";

	var Papa = require("../papaparse.js");

	var fs = require('fs');
	var assert = require('assert');
	var longSampleRawCsv = fs.readFileSync(__dirname + '/long-sample.csv', 'utf8');

	function assertLongSampleParsedCorrectly(parsedCsv) {
		assert.equal(8, parsedCsv.data.length)
		assert.deepEqual(parsedCsv.data[0], [
			'Grant',
			'Dyer',
			'Donec.elementum@orciluctuset.example',
			'2013-11-23T02:30:31-08:00',
			'2014-05-31T01:06:56-07:00',
			'Magna Ut Associates',
			'ljenkins'
		])
		assert.deepEqual(parsedCsv.data[7], [
			'Talon',
			'Salinas',
			'posuere.vulputate.lacus@Donecsollicitudin.example',
			'2015-01-31T09:19:02-08:00',
			'2014-12-17T04:59:18-08:00',
			'Aliquam Iaculis Incorporate',
			'Phasellus@Quisquetincidunt.example'
		]);
		assert.deepEqual(parsedCsv.meta, {
			"delimiter":",",
			"linebreak":"\n",
			"aborted":false,
			"truncated":false,
			"cursor":1209
		});
		assert.equal(parsedCsv.errors.length, 0)
	}

	describe('PapaParse', function() {
		it('synchronously parsed CSV should be correctly parsed', function() {
			assertLongSampleParsedCorrectly(Papa.parse(longSampleRawCsv));
		});

		it('asynchronously parsed CSV should be correctly parsed', function(done) {
			Papa.parse(longSampleRawCsv, {
				complete: function(parsedCsv) {
					assertLongSampleParsedCorrectly(parsedCsv);
					done();
				},
			});
		});

		it('asynchronously parsed streaming CSV should be correctly parsed', function(done) {
			Papa.parse(fs.createReadStream(__dirname + '/long-sample.csv', 'utf8'), {
				complete: function(parsedCsv) {
					assertLongSampleParsedCorrectly(parsedCsv);
					done();
				},
			});
		});
	});

})();
