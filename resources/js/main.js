$(function()
{
	// Settings - configure at will
	var scrollDuration = 400;
	var reallyBig = 1024 * 1024;	// 1 MB
	var textDemos = {
		basic: {
			input: '1-1,1-2,1-3,1-4\n2-1,2-2,2-3,2-4\n3-1,3-2,3-3,3-4',
			header: false,
			dynamicTyping: false,
			stream: false
		},
		header: {
			input: 'First;Second;Third\n1-1;1-2;1-3\n2-1;2-2;2-3',
			header: true,
			dynamicTyping: false,
			stream: false
		},
		numbers: {
			input: 'Item|SKU|Cost|Quantity\nBook|ABC1234|10.95|4\nMovie|DEF5678|29.99|3',
			header: true,
			dynamicTyping: true,
			stream: false
		},
		malformed: {
			input: 'Item,SKU,Cost,Quantity\nBook,ABC1234,10.95,4,Extra\nMovie,DEF5678",29.99,3',
			header: true,
			dynamicTyping: true,
			stream: false
		}
	};

	// State - don't touch!
	var scrolledToDemoOnce = false;
	var rowCount = 0, errCount = 0, finished = 0, queued = 0;
	var start, end;



	prepareDemo();

	// Smooth in-page scrolling; thanks to css-tricks.com
	$('body').on('click', 'a[href^=#]:not([href=#])', function(event)
	{
		var isDemoLink = $(this).hasClass('demo-insert');
		
		if (isDemoLink && scrolledToDemoOnce)
			return suppress(event);
		else if (isDemoLink)
			scrolledToDemoOnce = true;

		if (location.pathname.replace(/^\//,'') == this.pathname.replace(/^\//,'') 
			|| location.hostname == this.hostname)
		{
			scrollTo(this.hash);
			return suppress(event);
		}
	}).on('click', 'a[href=#]', function(event) {
		$('html, body').animate({
			scrollTop: 0
		}, scrollDuration);
		return suppress(event);
	});

	function scrollTo(idStr)
	{
		var target = $(idStr);
		target = target.length ? target : $('[name=' + idStr.slice(1) +']');

		if (target.length)
		{
			$('html, body').animate({
				scrollTop: target.offset().top - 40
			}, scrollDuration);
		}
	}

	function prepareDemo()
	{
		demoHelperBindings();

		$('#submit').click(function()
		{
			var self = $(this);
			self.prop('disabled', true);
			scrollTo('#demooutput');

			if (self.text().indexOf("Text") > -1)
			{
				// PARSE TEXT

				var input = $('#input').val();
				rowCount = 0;
				errCount = 0;

				if (!input)
				{
					statusErr("** Nothing to parse - please provide input **");
					$('#input').focus();
					return done();
				}

				if (!bigCheck(input))
				{
					statusErr("** Parsing aborted - recommend streaming large strings **");
					return done();
				}

				status("Parsing text...");

				$('#output').empty();

				perfStart();
				var data = $.parse(input, userConfig());
				perfEnd();

				if (is('stream'))
				{
					var baseMsg = "Finished parsing <b>" + rowCount + " rows</b> of data in <b>" + perfResult() + "</b> with <b>" + errCount + " errors</b>.";
					if (errCount == 0)
						statusGood("&#10003; " + baseMsg);
					else	
						statusErr("x " + baseMsg);
					status("(Only the end of the stream renders below.)");
					render(data);
				}
				else
				{
					if (is('header'))
						rowCount = data.results.rows.length;
					else
						rowCount = data.results.length;

					var out = "Finished <b>" + rowCount + " rows</b> in <b>" + perfResult() + "</b> with <b>" + data.errors.length + " errors</b>.";
					if (data.errors.length == 0)
						statusGood("&#10003; " + out);
					else
						statusErr("x " + out);
					render(data);
				}

				done();
			}
			else
			{
				// PARSE FILE(S)

				queued = $('#file')[0].files.length;

				$('#file').parse(
				{
					before: function(file, inputElem)
					{
						rowCount = 0;
						errCount = 0;

						if (!bigCheck(file))
							return false;

						status("Parsing <b>" + file.name + "</b>...");
						perfStart();
					},
					error: function(err, file, elem)
					{
						finished++;
						statusErr("Error loading " + (file ? file.name : "files") + ": " + err.name);
						if (finished >= queued || err.name == "AbortError")
							done(file ? file.name : file);
					},
					complete: function(data, file, inputElem, event)
					{
						perfEnd();

						finished++;
						$('#output').empty();

						if (!is('stream'))
						{
							if (is('header'))
								rowCount = data.results.rows.length;
							else
								rowCount = data.results.length;
						}

						var baseMsg = "Parsed <b>" + file.name + "</b> containing <b>" + rowCount + " rows</b> in <b>" + perfResult() + "</b> with <b>" + (is('stream') ? errCount : data.errors.length) + " errors</b>.";

						if (!is('stream'))
						{
							if (data.errors.length == 0)
								statusGood("&#10003; " + baseMsg);
							else
								statusErr("x " + baseMsg);
						}
						else
						{
							if (errCount == 0)
								statusGood("&#10003; " + baseMsg);
							else
								statusErr("x " + baseMsg);
							status("(The results are no longer available because they were streamed.)");
						}

						render(data);

						if (finished == queued)
							done(file.name);
					},
					config: userConfig()
				});

			}
		});
	}

	function done(filename)
	{
		$('#submit').prop('disabled', false);
		rowCount = 0;
		errCount = 0;
		finished = 0;
		queued = 0;
		status("");
	}

	function bigCheck(input)
	{
		if (typeof input === 'string')
		{
			if (!is('stream') && input.length > reallyBig)
				return confirm("Your input string is long and you didn't choose to stream it! Continuing might lock up or crash your browser tab. Are you sure you want to swallow the input whole?");
		}
		else if (typeof input === "object" && input.size)
		{
			if (!is('stream') && input.size > reallyBig)
				return confirm(input.name + " is a sizable file, and you didn't choose to stream it. Continuing may lock up or crash your browser tab. Are you sure you want to swallow this file whole?");
		}
		return true;
	}

	function perfStart()
	{
		if (window.performance)
			start = performance.now();
	}

	function perfEnd()
	{
		if (window.performance)
			end = performance.now();
	}

	function perfResult()
	{
		if (window.performance)
			return Math.round(end - start) + " ms";
		else
			return "(Duration unknown; your browser doesn't support the Performance API.)";
	}

	function userConfig()
	{
		return {
			delimiter: $('#delim').val(),
			header: is('header'),
			dynamicTyping: is('dyntype'),
			step: is('stream') ? stepFunc : undefined
		};
	}

	function stepFunc(data, file, inputElem)
	{
		//console.log(data.results);
		rowCount++;
		errCount += data.errors.length;
	}

	function is(checkboxId)
	{
		return $('#'+checkboxId).is(':checked');
	}

	function output(str)
	{
		$('#output').text(str);
	}

	function render(results)
	{
		output(JSON.stringify(results, undefined, 2));
	}

	function statusErr(str)
	{
		status('<span style="color: #FF5656;">' + str + '</span>');
	}

	function statusGood(str)
	{
		status('<span style="color: #33DB33;">' + str + '</span>')
	}

	function status(text)
	{
		var status = $('#status');
		status.append("<br>" + text);
		status.scrollTop(status[0].scrollHeight);
	}

	function demoHelperBindings()
	{
		$('.demo-insert').click(function()
		{
			var demo = textDemos[$(this).data('demo')];
			$('#clearfiles').click();
			$('#input').val(demo.input);
			$('#header').prop('checked', demo.header);
			$('#dyntype').prop('checked', demo.dynamicTyping);
			$('#stream').prop('checked', demo.stream);
		});

		$('#tabdelim').click(function()
		{
			$('#delim').val("\t").change();
		});

		$('#clearfiles').click(function()
		{
			$('#file').val("").change();
		});

		$('#file').change(function()
		{
			var fileCount = this.files.length;
			if (fileCount == 0)
				$('#submit').text("Parse Text");
			else if (fileCount == 1)
				$('#submit').text("Parse File");
			else
				$('#submit').text("Parse Files");
		});
	}
});


function suppress(event)
{
	if (!event)
		return false;
	if (event.preventDefault)
		event.preventDefault();
	if (event.stopPropagation)
		event.stopPropagation();
	event.cancelBubble = true;
	return false;
}