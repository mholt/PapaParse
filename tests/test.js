var connect = require('connect');
var serveStatic = require('serve-static');
var open = require('open');
var path = require('path');
var childProcess = require('child_process');

var server = connect().use(serveStatic(path.join(__dirname, '/..'))).listen(8071, function() {
	if (process.argv.indexOf('--phantomjs') !== -1) {
		childProcess.spawn('node_modules/.bin/mocha-phantomjs', ['http://localhost:8071/tests/tests.html'], {
			stdio: 'inherit'
		}).on('exit', function() {
			server.close();
		});

	} else {
		open('http://localhost:8071/tests/tests.html');
		console.log('Serving tests...');
	}
});
