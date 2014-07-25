var stepped = 0, chunks = 0, rows = 0;
var start, end;

$(function()
{
	$('#submit').click(function()
	{
		stepped = 0;
		chunks = 0;
		rows = 0;

		var txt = $('#input').val();
		var localChunkSize = $('#localChunkSize').val();
		var remoteChunkSize = $('#remoteChunkSize').val();
		var files = $('#files')[0].files;
		var config = buildConfig();

		// NOTE: Chunk size does not get reset if changed and then set back to empty/default value
		if (localChunkSize)
			Papa.LocalChunkSize = localChunkSize;
		if (remoteChunkSize)
			Papa.RemoteChunkSize = remoteChunkSize;
		

		if (files.length > 0)
		{
			start = performance.now();
			
			$('#files').parse({
				config: config,
				before: function(file, inputElem)
				{
					console.log("Parsing file:", file);
				},
				complete: function()
				{
					console.log("Done with all files.");
				}
			});
		}
		else
		{
			start = performance.now();
			var results = Papa.parse(txt, config);
			console.log("Synchronous parse results:", results);
		}
	});

	$('#insert-tab').click(function()
	{
		$('#delimiter').val('\t');
	});
});



function buildConfig()
{
	return {
		delimiter: $('#delimiter').val(),
		header: $('#header').prop('checked'),
		dynamicTyping: $('#dynamicTyping').prop('checked'),
		preview: parseInt($('#preview').val() || 0),
		step: $('#stream').prop('checked') ? stepFn : undefined,
		encoding: $('#encoding').val(),
		worker: $('#worker').prop('checked'),
		comments: $('#comments').val(),
		complete: completeFn,
		download: $('#download').prop('checked'),
		keepEmptyRows: $('#keepEmptyRows').prop('checked'),
		chunk: $('#chunk').prop('checked') ? chunkFn : undefined
	};
}

function stepFn(results, parser)
{
	stepped++;
	rows += results.data.length;
}

function chunkFn(results, file)
{
	if (!results)
		return;
	chunks++;
	rows += results.data.length;
}

function completeFn()
{
	end = performance.now();
	if (arguments[0] && arguments[0].data)
		rows = arguments[0].data.length;
	
	console.log("Finished input. Time:", end-start, arguments);
	console.log("Rows:", rows, "Stepped:", stepped, "Chunks:", chunks);
}