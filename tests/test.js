var connect = require('connect');
var serveStatic = require('serve-static');
var open = require('open');
var path = require('path');

connect().use(serveStatic(path.join(__dirname, '/..'))).listen(8071, function() {
  open('http://localhost:8071/tests/tests.html');
  console.log('Serving tests...');
});
