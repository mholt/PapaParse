module.exports = {
	setup: function(Papa) {
		
		var util = require('./util'),
			ParserHandle = require('./ParserHandle');

		// NOTE/TODO: Many of the functions of NetworkStreamer and FileStreamer are the same. Consolidate?
		function NetworkStreamer(config)
		{
			var IS_WORKER = util.isWorker();

			config = config || {};
			if (!config.chunkSize)
				config.chunkSize = Papa.RemoteChunkSize;

			var start = 0, fileSize = 0;
			var aggregate = "";
			var partialLine = "";
			var xhr, nextChunk;
			var handle = new ParserHandle(util.copy(config));

			this.stream = function(url)
			{
				if (IS_WORKER)
				{
					nextChunk = function()
					{
						readChunk();
						chunkLoaded();
					};
				}
				else
				{
					nextChunk = function()
					{
						readChunk();
					};
				}

				nextChunk();	// Starts streaming


				function readChunk()
				{
					xhr = new XMLHttpRequest();
					if (!IS_WORKER)
					{
						xhr.onload = chunkLoaded;
						xhr.onerror = chunkError;
					}
					xhr.open("GET", url, !IS_WORKER);
					if (config.step)
					{
						var end = start + config.chunkSize - 1;	// minus one because byte range is inclusive
						if (fileSize && end > fileSize) // Hack around a Chrome bug: http://stackoverflow.com/q/24745095/1048862
							end = fileSize;
						xhr.setRequestHeader("Range", "bytes="+start+"-"+end);
					}
					xhr.send();
					if (IS_WORKER && xhr.status == 0)
						chunkError();
					else
						start += config.chunkSize;
				}

				function chunkLoaded()
				{
					if (xhr.readyState != 4)
						return;

					if (xhr.status < 200 || xhr.status >= 400)
					{
						chunkError();
						return;
					}

					// Rejoin the line we likely just split in two by chunking the file
					aggregate += partialLine + xhr.responseText;
					partialLine = "";

					var finishedWithEntireFile = !config.step || start > getFileSize(xhr);

					if (!finishedWithEntireFile)
					{
						var lastLineEnd = aggregate.lastIndexOf("\n");

						if (lastLineEnd < 0)
							lastLineEnd = aggregate.lastIndexOf("\r");

						if (lastLineEnd > -1)
						{
							partialLine = aggregate.substring(lastLineEnd + 1);	// skip the line ending character
							aggregate = aggregate.substring(0, lastLineEnd);
						}
						else
						{
							// For chunk sizes smaller than a line (a line could not fit in a single chunk)
							// we simply build our aggregate by reading in the next chunk, until we find a newline
							nextChunk();
							return;
						}
					}

					var results = handle.parse(aggregate);
					aggregate = "";

					if (IS_WORKER)
					{
						global.postMessage({
							results: results,
							workerId: Papa.WORKER_ID,
							finished: finishedWithEntireFile
						});
					}
					else if (util.isFunction(config.chunk))
					{
						config.chunk(results);	// TODO: Implement abort? (like step)
						results = undefined;
					}
					
					if (finishedWithEntireFile && util.isFunction(config.complete))
						config.complete(results);
					else if (results && results.meta.aborted && util.isFunction(config.complete))
						config.complete(results);
					else if (!finishedWithEntireFile)
						nextChunk();
				}

				function chunkError()
				{
					if (util.isFunction(config.error))
						config.error(xhr.statusText);
					else if (IS_WORKER && config.error)
					{
						global.postMessage({
							workerId: Papa.WORKER_ID,
							error: xhr.statusText,
							finished: false
						});
					}
				}

				function getFileSize(xhr)
				{
					var contentRange = xhr.getResponseHeader("Content-Range");
					return parseInt(contentRange.substr(contentRange.lastIndexOf("/") + 1));
				}
			};
		}

		return NetworkStreamer;
	}
};