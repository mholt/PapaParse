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
	['step', 'chunk'].forEach(function(mode) {
		it('cleans up a readable when aborted while ' + mode + ' parsing is paused', function(done) {
			var PassThrough = require('stream').PassThrough;
			var source = new PassThrough();
			var handle;
			var calls = 0;
			var completed = 0;
			var snapshot;
			var config = {
				delimiter: ',',
				complete: function(results) {
					completed++;
					snapshot = [results.meta.aborted, source.listenerCount('data'), source.listenerCount('end'), source.listenerCount('error')];
				}
			};
			config[mode] = function(results, parser) {
				calls++;
				handle = parser;
				parser.pause();
			};
			Papa.parse(source, config);
			source.write('first,row\n');
			source.write('queued,row\n');
			handle.abort();
			assert.deepEqual(snapshot, [true, 0, 0, 0]);
			assert.strictEqual(source.isPaused(), true);
			assert.strictEqual(source.destroyed, false);
			source.on('end', function() {
				assert.strictEqual(calls, 1);
				assert.strictEqual(completed, 1);
				done();
			});
			source.end('later,row\n');
			source.resume();
		});
		[true, false].forEach(function(pipeFirst) {
			it('preserves a shared pipe and end after ' + mode + ' abort (pipe first: ' + pipeFirst + ')', function(done) {
				var streams = require('stream');
				var source = new streams.PassThrough();
				var chunks = [];
				var ended = 0;
				var completed = 0;
				var calls = 0;
				var sink = new streams.Writable({write: function(chunk, encoding, callback) {
					chunks.push(chunk.toString());
					callback();
				}});
				var config = {delimiter: ',', complete: function() { completed++; }};
				config[mode] = function(results, parser) { calls++; parser.abort(); };
				source.on('end', function() { ended++; });
				if (pipeFirst) source.pipe(sink);
				Papa.parse(source, config);
				if (!pipeFirst) source.pipe(sink);
				sink.on('finish', function() {
					assert.deepEqual(chunks, ['first,row\n', 'second,row\n']);
					assert.strictEqual(ended, 1);
					assert.strictEqual(completed, 1);
					assert.strictEqual(calls, 1);
					done();
				});
				source.write('first,row\n');
				source.end('second,row\n');
			});
		});
	});
	it('keeps another readable consumer flowing after parsing is aborted', function(done) {
		var PassThrough = require('stream').PassThrough;
		var source = new PassThrough();
		var chunks = [];
		source.on('data', function(chunk) { chunks.push(chunk.toString()); });
		Papa.parse(source, {delimiter: ',', step: function(results, parser) { parser.abort(); }});
		source.write('first,row\n');
		source.end('second,row\n');
		setImmediate(function() {
			assert.deepEqual(chunks, ['first,row\n', 'second,row\n']);
			done();
		});
	});
	['step', 'chunk'].forEach(function(mode) {
		it('detaches from a readable stream when ' + mode + ' parsing is aborted', function(done) {
			var PassThrough = require('stream').PassThrough;
			var source = new PassThrough();
			var calls = 0;
			var completed = 0;
			var failures = [];
			var expectedError = new Error('source error after abort');
			var sourceErrors = [];
			var listenersAtComplete;
			source.on('error', function(error) { sourceErrors.push(error); });
			var config = {
				delimiter: ',',
				error: function(error) { failures.push(error); },
				complete: function(results) {
					completed++;
					assert.strictEqual(results.meta.aborted, true);
					listenersAtComplete = ['data', 'end', 'error'].map(function(event) {
						return source.listenerCount(event);
					});
				}
			};
			config[mode] = function(results, parser) {
				calls++;
				parser.abort();
			};
			Papa.parse(source, config);
			source.write('a,b\n');
			source.emit('error', expectedError);
			source.end('c,d\n');
			setImmediate(function() {
				assert.deepEqual(listenersAtComplete, [0, 0, 1]);
				assert.strictEqual(calls, 1);
				assert.strictEqual(completed, 1);
				assert.deepEqual(failures, []);
				assert.deepEqual(sourceErrors, [expectedError]);
				assert.strictEqual(source.destroyed, false);
				done();
			});
		});
	});
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
