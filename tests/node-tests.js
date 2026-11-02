"use strict";

var Papa = require("../papaparse.js");

var fs = require('fs');
var assert = require('assert');
var longSampleRawCsv = fs.readFileSync(__dirname + '/long-sample.csv', 'utf8');
var utf8BomSampleRawCsv = fs.readFileSync(__dirname + '/utf-8-bom-sample.csv', 'utf8');

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
		renamedHeaders: null,
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

	it('Pause and resume maintains cursor offset correctly (Regression Test for Bug #1054)', function(done) {
		// Input is 28 JS code units. chunkSize:15 creates 2 real chunks, so the pause
		// crosses a chunk boundary. meta.cursor is a JavaScript string offset,
		// measured in UTF-16 code units from the beginning of the full input.
		var fileData = 'A,B\n' + '11,22\n' + '33,44\n' + '55,66\n' + '77,88\n';
		// Cursor after each row: header(4)+11,22\n(6)=10, +33,44\n(6)=16, +55,66\n(6)=22,
		// +77,88\n(6)=28. The trailing newline causes one extra empty-row step at 28.
		var expectedCursors = [10, 16, 22, 28, 28];
		var cursors = [];
		var rows = [];
		Papa.parse(fileData, {
			header: true,
			chunkSize: 15,
			step: function(results, parser) {
				cursors.push(results.meta.cursor);
				if (results.data.A) rows.push(results.data.A);
				if (results.data.A === '33') {
					parser.pause();
					parser.resume();
				}
			},
			complete: function() {
				assert.deepEqual(cursors, expectedCursors);
				assert.deepEqual(rows, ['11', '33', '55', '77']);
				done();
			}
		});
	});

	it('cursor accumulates correctly when pausing on every row asynchronously (Bug #1054)', function(done) {
		this.timeout(5000);
		// Every step callback pauses and resumes asynchronously. Cursor must
		// increase monotonically, never repeating the same value across chunks.
		// Input: 'X\n1\n2\n3\n4\n5\n' — 12 JS code units, chunkSize:3 forces many chunks.
		// Header "X\n"=2, rows "1\n"=2 each, so expected absolute cursors: 4,6,8,10,12.
		var fileData = 'X\n1\n2\n3\n4\n5\n';
		var expectedRows  = ['1','2','3','4','5'];
		var expectedCursors = [4, 6, 8, 10, 12];
		var cursors = [];
		var rows = [];
		Papa.parse(fileData, {
			header: true,
			chunkSize: 3,
			step: function(results, parser) {
				if (results.data.X) rows.push(results.data.X);
				cursors.push(results.meta.cursor);
				parser.pause();
				setTimeout(function() { parser.resume(); }, 0);
			},
			complete: function() {
				assert.deepEqual(rows, expectedRows);
				assert.deepEqual(cursors, expectedCursors);
				done();
			}
		});
	});

	it('cursor uses JavaScript string offsets (UTF-16 code units) (Bug #1054)', function(done) {
		// The character "é" in "café" is a single BMP code point and 1 JS code unit,
		// but 2 UTF-8 bytes. The cursor must match JS string length.
		// "item,price\n"=11, "caf\u00e9,3\n"=7, "pizza,8\n"=8 → total 26 code units.
		// Expected cursors: header(11)+row1(7)=18, +row2(8)=26.
		var fileData = 'item,price\ncaf\u00e9,3\npizza,8\n';
		var expectedCursors = [18, 26];
		var cursors = [];
		var rows = [];
		Papa.parse(fileData, {
			header: true,
			chunkSize: 12,
			step: function(results, parser) {
				cursors.push(results.meta.cursor);
				rows.push(results.data.item);
				parser.pause();
				setTimeout(function() { parser.resume(); }, 0);
			},
			complete: function() {
				assert.deepEqual(rows, ['caf\u00e9', 'pizza']);
				assert.deepEqual(cursors, expectedCursors);
				done();
			}
		});
	});

	it('abort from step does not emit extra rows or throw (Bug #1054 coverage)', function(done) {
		// The fix touches the combined paused-or-aborted branch. Verify that aborting
		// from a step callback still stops parsing cleanly with correct row data.
		var fileData = 'A,B\n11,22\n33,44\n55,66\n';
		var rows = [];
		var completeCount = 0;
		var completeResults = null;
		Papa.parse(fileData, {
			header: true,
			chunkSize: 10,
			step: function(results, parser) {
				rows.push(Object.assign({}, results.data));
				if (results.data.A === '33') {
					parser.abort();
				}
			},
			complete: function(results) {
				completeCount++;
				completeResults = results;
			}
		});
		// String streamer is fully synchronous even with chunkSize
		assert.strictEqual(completeCount, 1, 'complete callback should execute exactly once');
		assert.strictEqual(completeResults.meta.aborted, true, 'meta.aborted should be true');
		assert.deepEqual(rows, [{A: '11', B: '22'}, {A: '33', B: '44'}], 'Only rows up to the abort trigger should be collected');
		done();
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

	it('handles utf-8 BOM encoded files', function(done) {
		Papa.parse(utf8BomSampleRawCsv, {
			header: true,
			complete: function(parsedCsv) {
				assert.deepEqual(parsedCsv.data[0], { A: 'X', B: 'Y', C: 'Z' });
				done();
			}
		});
	});
});
