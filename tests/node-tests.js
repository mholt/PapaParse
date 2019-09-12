"use strict";

var Papa = require("../papaparse.js");

var fs = require('fs');
var assert = require('assert');
var longSampleRawCsv = fs.readFileSync(__dirname + '/long-sample.csv', 'utf8');

function assertLongSampleParsedCorrectly(parsedCsv) {
	assert.equal(8, parsedCsv.data.length);
	assert.deepEqual(parsedCsv.data[0], [
		'Grant',
		'Dyer',
		'Donec.elementum@orciluctuset.example',
		'2013-11-23T02:30:31-08:00',
		'2014-05-31T01:06:56-07:00',
		'Magna Ut Associates',
		'ljenkins'
	]);
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
		"delimiter": ",",
		"linebreak": "\n",
		"aborted": false,
		"truncated": false,
		"cursor": 1209
	});
	assert.equal(parsedCsv.errors.length, 0);
}

describe('PapaParse', function() {
	it('synchronously parsed CSV should be correctly parsed', function() {
		assertLongSampleParsedCorrectly(Papa.parse(longSampleRawCsv));
	});

	it('Pause and resume works (Regression Test for Bug #636)', function(done) {
		this.timeout(30000);
		var mod200Rows = [
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
		];
		var stepped = 0;
		var dataRows = [];
		Papa.parse(fs.createReadStream(__dirname + '/verylong-sample.csv'), {
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
				assert.strictEqual(2001, stepped);
				assert.deepEqual(mod200Rows, dataRows);
				done();
			}
		});
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

	it('reports the correct row number on FieldMismatch errors', function(done) {
		Papa.parse(fs.createReadStream(__dirname + '/verylong-sample.csv'), {
			header: true,
			fastMode: true,
			complete: function(parsedCsv) {
				assert.deepEqual(parsedCsv.errors, [
					{
						"type": "FieldMismatch",
						"code": "TooFewFields",
						"message": "Too few fields: expected 3 fields but parsed 2",
						"row": 498
					},
					{
						"type": "FieldMismatch",
						"code": "TooFewFields",
						"message": "Too few fields: expected 3 fields but parsed 2",
						"row": 998
					},
					{
						"type": "FieldMismatch",
						"code": "TooFewFields",
						"message": "Too few fields: expected 3 fields but parsed 2",
						"row": 1498
					},
					{
						"type": "FieldMismatch",
						"code": "TooFewFields",
						"message": "Too few fields: expected 3 fields but parsed 2",
						"row": 1998
					}
				]);
				assert.strictEqual(2000, parsedCsv.data.length);
				done();
			},
		});
	});

	it('piped streaming CSV should be correctly parsed', function(done) {
		var data = [];
		var readStream = fs.createReadStream(__dirname + '/long-sample.csv', 'utf8');
		var csvStream = readStream.pipe(Papa.parse(Papa.NODE_STREAM_INPUT));
		csvStream.on('data', function(item) {
			data.push(item);
		});
		csvStream.on('end', function() {
			assert.deepEqual(data[0], [
				'Grant',
				'Dyer',
				'Donec.elementum@orciluctuset.example',
				'2013-11-23T02:30:31-08:00',
				'2014-05-31T01:06:56-07:00',
				'Magna Ut Associates',
				'ljenkins'
			]);
			assert.deepEqual(data[7], [
				'Talon',
				'Salinas',
				'posuere.vulputate.lacus@Donecsollicitudin.example',
				'2015-01-31T09:19:02-08:00',
				'2014-12-17T04:59:18-08:00',
				'Aliquam Iaculis Incorporate',
				'Phasellus@Quisquetincidunt.example'
			]);
			done();
		});
	});


	it('piped streaming CSV should be correctly parsed when header is true', function(done) {
		var data = [];
		var readStream = fs.createReadStream(__dirname + '/sample-header.csv', 'utf8');
		var csvStream = readStream.pipe(Papa.parse(Papa.NODE_STREAM_INPUT, {header: true}));
		csvStream.on('data', function(item) {
			data.push(item);
		});
		csvStream.on('end', function() {
			assert.deepEqual(data[0], { title: 'test title 01', name: 'test name 01' });
			assert.deepEqual(data[1],  { title: '', name: 'test name 02' });
			done();
		});
	});

	it('should support pausing and resuming on same tick when streaming', function(done) {
		var rows = [];
		Papa.parse(fs.createReadStream(__dirname + '/long-sample.csv', 'utf8'), {
			chunk: function(results, parser) {
				rows = rows.concat(results.data);
				parser.pause();
				parser.resume();
			},
			error: function(err) {
				done(new Error(err));
			},
			complete: function() {
				assert.deepEqual(rows[0], [
					'Grant',
					'Dyer',
					'Donec.elementum@orciluctuset.example',
					'2013-11-23T02:30:31-08:00',
					'2014-05-31T01:06:56-07:00',
					'Magna Ut Associates',
					'ljenkins'
				]);
				assert.deepEqual(rows[7], [
					'Talon',
					'Salinas',
					'posuere.vulputate.lacus@Donecsollicitudin.example',
					'2015-01-31T09:19:02-08:00',
					'2014-12-17T04:59:18-08:00',
					'Aliquam Iaculis Incorporate',
					'Phasellus@Quisquetincidunt.example'
				]);
				done();
			}
		});
	});

	it('should support pausing and resuming asynchronously when streaming', function(done) {
		var rows = [];
		Papa.parse(fs.createReadStream(__dirname + '/long-sample.csv', 'utf8'), {
			chunk: function(results, parser) {
				rows = rows.concat(results.data);
				parser.pause();
				setTimeout(function() {
					parser.resume();
				}, 200);
			},
			error: function(err) {
				done(new Error(err));
			},
			complete: function() {
				assert.deepEqual(rows[0], [
					'Grant',
					'Dyer',
					'Donec.elementum@orciluctuset.example',
					'2013-11-23T02:30:31-08:00',
					'2014-05-31T01:06:56-07:00',
					'Magna Ut Associates',
					'ljenkins'
				]);
				assert.deepEqual(rows[7], [
					'Talon',
					'Salinas',
					'posuere.vulputate.lacus@Donecsollicitudin.example',
					'2015-01-31T09:19:02-08:00',
					'2014-12-17T04:59:18-08:00',
					'Aliquam Iaculis Incorporate',
					'Phasellus@Quisquetincidunt.example'
				]);
				done();
			}
		});
	});

	it('handles errors in beforeFirstChunk', function(done) {
		var expectedError = new Error('test');
		Papa.parse(fs.createReadStream(__dirname + '/long-sample.csv', 'utf8'), {
			beforeFirstChunk: function() {
				throw expectedError;
			},
			error: function(err) {
				assert.deepEqual(err, expectedError);
				done();
			}
		});
	});

	it('handles errors in chunk', function(done) {
		var expectedError = new Error('test');
		Papa.parse(fs.createReadStream(__dirname + '/long-sample.csv', 'utf8'), {
			chunk: function() {
				throw expectedError;
			},
			error: function(err) {
				assert.deepEqual(err, expectedError);
				done();
			}
		});
	});

	it('handles errors in step', function(done) {
		var expectedError = new Error('test');
		Papa.parse(fs.createReadStream(__dirname + '/long-sample.csv', 'utf8'), {
			step: function() {
				throw expectedError;
			},
			error: function(err) {
				assert.deepEqual(err, expectedError);
				done();
			}
		});
	});
});
