var connect = require('connect');
var serveStatic = require('serve-static');
var open = require('open');
var path = require('path');
var childProcess = require('child_process');

// Artificial delay so the downloadTimeout tests can deterministically exercise a slow request.
var SLOW_SAMPLE_DELAY_MS = 1000;

var server = connect().
	use('/tests/slow-sample.csv', function(req, res, next) {
		setTimeout(next, SLOW_SAMPLE_DELAY_MS);
	}).
	use(serveStatic(path.join(__dirname, '/..'))).
	listen(8071, function() {
		if (process.argv.indexOf('--mocha-headless-chrome') !== -1) {
			childProcess.spawn('node_modules/.bin/mocha-headless-chrome', ['-f', 'http://localhost:8071/tests/tests.html'], {
				stdio: 'inherit'
			}).on('exit', function(code) {
				server.close();
				process.exit(code);  // eslint-disable-line no-process-exit
			});

		} else {
			open('http://localhost:8071/tests/tests.html');
			console.log('Serving tests...');
		}
	});
