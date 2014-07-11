var stepped = 0;
var start, end;

$(function()
{
	$('#submit').click(function()
	{
		var txt = $('#input').val();
		var files = $('#files')[0].files;
		stepped = 0;

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
		dynamicTyping: $('#header').prop('checked'),
		preview: parseInt($('#preview').val()),
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