var stepped = 0;
var start, end;

$(function()
{
	$('#submit').click(function()
	{
		stepped = 0;
		var txt = $('#input').val();
		var files = $('#files')[0].files;
		var config = buildConfig();

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
		download: $('#download').prop('checked')
	};
}

function stepFn(results, parser)
{
	stepped++;
}

function completeFn()
{
	end = performance.now();
	console.log("Finished input. Time:", end-start, arguments);
}