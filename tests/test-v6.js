var connect = require('connect');
var serveStatic = require('serve-static');
var open = require('open');
var path = require('path');
var childProcess = require('child_process');
var fs = require('fs');

// Get the Papa Parse entry point from environment variable
var papaEntryPoint = process.env.PAPA_ENTRY_POINT || '../legacy/papaparse.js';

// Read the original tests.html template
var testHtmlTemplate = fs.readFileSync(path.join(__dirname, 'tests.html'), 'utf8');

// Create a temporary HTML file with the correct Papa Parse path
var modifiedHtml = testHtmlTemplate.replace('../legacy/papaparse.js', papaEntryPoint);

// Write the modified HTML to a temporary file
var tempHtmlPath = path.join(__dirname, '.tests-v6-temp.html');
fs.writeFileSync(tempHtmlPath, modifiedHtml);

// Function to clean up temporary file
function cleanup() {
	try {
		fs.unlinkSync(tempHtmlPath);
	} catch (e) {
		// Ignore errors during cleanup
	}
}

// Handle process termination
process.on('exit', cleanup);
process.on('SIGINT', function() {
	cleanup();
	process.exit();
});

var app = connect();

// Serve the modified HTML when accessing the test page
app.use('/tests/tests.html', function(req, res) {
	res.setHeader('Content-Type', 'text/html');
	res.end(modifiedHtml);
});

// Serve static files normally
app.use(serveStatic(path.join(__dirname, '/..')));

var server = app.listen(8071, function() {
	console.log('Testing with Papa Parse entry point:', papaEntryPoint);

	if (process.argv.indexOf('--mocha-headless-chrome') !== -1) {
		childProcess.spawn('node_modules/.bin/mocha-headless-chrome', ['-f', 'http://localhost:8071/tests/tests.html', '-a="--no-sandbox"'], {
			stdio: 'inherit'
		}).on('exit', function(code) {
			cleanup();
			server.close();
			process.exit(code);
		});
	} else {
		open('http://localhost:8071/tests/tests.html');
		console.log('Serving tests...');
	}
});
