'use strict';

var Parser = require('./src/Parser'),
	ParserHandle = require('./src/ParserHandle'),
	util = require('./src/util'),
	JsonToCsv = require('./src/JsonToCsv');

global.Papa = {};

module.exports = global.Papa;

global.Papa.RECORD_SEP = String.fromCharCode(30);
global.Papa.UNIT_SEP = String.fromCharCode(31);
global.Papa.BYTE_ORDER_MARK = "\ufeff";
global.Papa.BAD_DELIMITERS = ["\r", "\n", "\"", global.Papa.BYTE_ORDER_MARK];
global.Papa.WORKERS_SUPPORTED = !!global.Worker;

// Configurable chunk sizes for local and remote files, respectively
global.Papa.LocalChunkSize = 1024 * 1024 * 10;	// 10 MB
global.Papa.RemoteChunkSize = 1024 * 1024 * 5;	// 5 MB

//TODO Refactor this tangle of config code. This is required to pass in chunk sizing
var FileStreamer = require('./src/FileStreamer').setup(Papa),
	NetworkStreamer = require('./src/NetworkStreamer').setup(Papa)

// Exposed for testing and development only
global.Papa.Parser = Parser;
global.Papa.ParserHandle = ParserHandle;
global.Papa.NetworkStreamer = NetworkStreamer;
global.Papa.FileStreamer = FileStreamer;

global.Papa.unparse = JsonToCsv;
// TODO this is messy. Refactor worker code into module
global.Papa.parse = require('./src/CsvToJson').setup(newWorker); 

var SCRIPT_PATH;
var IS_WORKER = util.isWorker();
var workers = {};
var workerIdCounter = 0;

if (global.jQuery)
{
	var $ = global.jQuery;
	$.fn.parse = function(options)
	{
		var config = options.config || {};
		var queue = [];

		this.each(function(idx)
		{
			var supported = $(this).prop('tagName').toUpperCase() == "INPUT"
							&& $(this).attr('type').toLowerCase() == "file"
							&& global.FileReader;

			if (!supported || !this.files || this.files.length == 0)
				return true;	// continue to next input element

			for (var i = 0; i < this.files.length; i++)
			{
				queue.push({
					file: this.files[i],
					inputElem: this,
					instanceConfig: $.extend({}, config)
				});
			}
		});

		parseNextFile();	// begin parsing
		return this;		// maintains chainability


		function parseNextFile()
		{
			if (queue.length == 0)
			{
				if (util.isFunction(options.complete))
					options.complete();
				return;
			}

			var f = queue[0];

			if (util.isFunction(options.before))
			{
				var returned = options.before(f.file, f.inputElem);

				if (typeof returned === 'object')
				{
					if (returned.action == "abort")
					{
						error("AbortError", f.file, f.inputElem, returned.reason);
						return;	// Aborts all queued files immediately
					}
					else if (returned.action == "skip")
					{
						fileComplete();	// parse the next file in the queue, if any
						return;
					}
					else if (typeof returned.config === 'object')
						f.instanceConfig = $.extend(f.instanceConfig, returned.config);
				}
				else if (returned == "skip")
				{
					fileComplete();	// parse the next file in the queue, if any
					return;
				}
			}

			// Wrap up the user's complete callback, if any, so that ours also gets executed
			var userCompleteFunc = f.instanceConfig.complete;
			f.instanceConfig.complete = function(results)
			{
				if (util.isFunction(userCompleteFunc))
					userCompleteFunc(results, f.file, f.inputElem);
				fileComplete();
			};

			Papa.parse(f.file, f.instanceConfig);
		}

		function error(name, file, elem, reason)
		{
			if (util.isFunction(options.error))
				options.error({name: name}, file, elem, reason);
		}

		function fileComplete()
		{
			queue.splice(0, 1);
			parseNextFile();
		}
	}
}

if (IS_WORKER){
	global.onmessage = workerThreadReceivedMessage;
}
else if (Papa.WORKERS_SUPPORTED){
	SCRIPT_PATH = getScriptPath();
}

function getScriptPath() {
	var id = "worker" + String(Math.random()).substr(2);
	document.write('<script id="' + id + '"></script>');
	return document.getElementById(id).previousSibling.src;
}

function newWorker()
{
	if (!Papa.WORKERS_SUPPORTED || !SCRIPT_PATH) {
		return false;
	}
	var w = new global.Worker(SCRIPT_PATH);
	w.onmessage = mainThreadReceivedMessage;
	w.id = workerIdCounter++;
	workers[w.id] = w;
	return w;
}

// Callback when main thread receives a message
function mainThreadReceivedMessage(e)
{
	var msg = e.data;
	var worker = workers[msg.workerId];

	if (msg.error)
		worker.userError(msg.error, msg.file);
	else if (msg.results && msg.results.data)
	{
		if (util.isFunction(worker.userStep))
		{
			for (var i = 0; i < msg.results.data.length; i++)
			{
				worker.userStep({
					data: [msg.results.data[i]],
					errors: msg.results.errors,
					meta: msg.results.meta
				});
			}
		}
		else if (util.isFunction(worker.userChunk)) {
			worker.userChunk(msg.results, msg.file);
		}

		delete msg.results;	// free memory ASAP
	}

	if (msg.finished)
	{
		if (util.isFunction(workers[msg.workerId].userComplete)) {
			workers[msg.workerId].userComplete(msg.results);
		}
		workers[msg.workerId].terminate();
		delete workers[msg.workerId];
	}
}

// Callback when worker thread receives a message
function workerThreadReceivedMessage(e)
{
	var msg = e.data;

	if (typeof Papa.WORKER_ID === 'undefined' && msg) {
		Papa.WORKER_ID = msg.workerId;
	}

	if (typeof msg.input === 'string')
	{
		global.postMessage({
			workerId: Papa.WORKER_ID,
			results: Papa.parse(msg.input, msg.config),
			finished: true,
		});
	}
	else if (msg.input instanceof File)
	{
		var results = Papa.parse(msg.input, msg.config);
		if (results)
			global.postMessage({
				workerId: Papa.WORKER_ID,
				results: results,
				finished: true
			});
	}
}
