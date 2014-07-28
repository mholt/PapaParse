module.exports = {
	setup: function(newWorker){

		var util = require('./util'),
			configUtil = require('./config'),
			FileStreamer = require('./FileStreamer'),
			NetworkStreamer = require('./NetworkStreamer'),
			ParserHandle = require('./ParserHandle');

		function CsvToJson(_input, _config)
		{
			var config = util.isWorker() ? _config : configUtil.copyAndValidateConfig(_config);
			var w = config.worker && util.isFunction(newWorker) ? newWorker() : false;

			if (w) {
				w.userStep = config.step;
				w.userChunk = config.chunk;
				w.userComplete = config.complete;
				w.userError = config.error;

				config.step = util.isFunction(config.step);
				config.chunk = util.isFunction(config.chunk);
				config.complete = util.isFunction(config.complete);
				config.error = util.isFunction(config.error);
				delete config.worker;	// prevent infinite loop

				w.postMessage({
					input: _input,
					config: config,
					workerId: w.id
				});
			}
			else
			{
				if (typeof _input === 'string')
				{
					if (config.download)
					{
						var streamer = new NetworkStreamer(config);
						streamer.stream(_input);
					}
					else
					{
						var ph = new ParserHandle(config);
						var results = ph.parse(_input);
						if (util.isFunction(config.complete))
							config.complete(results);
						return results;
					}
				}
				else if (_input instanceof File)
				{
					if (config.step || config.chunk)
					{
						var streamer = new FileStreamer(config);
						streamer.stream(_input);
					}
					else
					{
						var ph = new ParserHandle(config);

						if (util.isWorker())
						{
							var reader = new FileReaderSync();
							var input = reader.readAsText(_input, config.encoding);
							return ph.parse(input);
						}
						else
						{
							reader = new FileReader();
							reader.onload = function(event)
							{
								var ph = new ParserHandle(config);
								var results = ph.parse(event.target.result);
								if (util.isFunction(config.complete))
									config.complete(results);
							};
							reader.readAsText(_input, config.encoding);
						}
					}
				}
			}
		}

		return CsvToJson;
	}
};

