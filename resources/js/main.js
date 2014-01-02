$(function()
{
	// Settings - configure at will
	var scrollDuration = 400;
	var reallyBig = 1024 * 1024;	// 1 MB
	var textDemos = {
		basic: 'AK,63.588753,-154.493062,Alaska\nAL,32.318231,-86.902298,Alabama\nAR,35.20105,-91.831833,Arkansas\nAZ,34.048928,-111.093731,Arizona\nCA,36.778261,-119.417932,California\nCO,39.550051,-105.782067,Colorado\nCT,41.603221,-73.087749,Connecticut\nDC,38.905985,-77.033418,"District of Columbia"\nDE,38.910832,-75.52767,Delaware\nFL,27.664827,-81.515754,Florida',
		header: 'Address,City,State,Zipcode,Name,Phone Number,Group,URL\n1 Crossgates Mall Road,Albany,NY,12203,Apple Store Cross Gates,(518) 869-3192,"Example ""Group"" 1",http://www.apple.com/retail/crossgates/\nDuke Rd & Walden Ave,Buffalo,NY,14225,Apple Store Walden Galleria,(716) 685-2762,Example Group 2,http://www.apple.com/retail/walden/\n630 Old Country Rd.,Garden City,NY,11530,Apple Store Roosevelt Field,(516) 248-3347,Example Group 3,http://www.apple.com/retail/rooseveltfield/\n160 Walt Whitman Rd.,Huntington Station,NY,11746,Apple Store Walt Whitman,(631) 425-1563,Example Group 3,http://www.apple.com/retail/waltwhitman/\n9553 Carousel Center Drive,Syracuse,NY,13290,Apple Store Carousel,(315) 422-8484,Example Group 2,http://www.apple.com/retail/carousel/\n2655 Richmond Ave,Staten Island,NY,10314,Apple Store Staten Island,(718) 477-4180,Example Group 1,http://www.apple.com/retail/statenisland/\n7979 Victor Road,Victor,NY,14564,Apple Store Eastview,(585) 421-3030,Example Group 1,http://www.apple.com/retail/eastview/\n1591 Palisades Center Drive,West Nyack,NY,10994,Apple Store Palisades,(845) 353-6756,Example Group 2,http://www.apple.com/retail/palisades/\n125 Westchester Ave.,White Plains,NY,10601,Apple Store The Westchester,(914) 428-1877,Example Group 3,http://www.apple.com/retail/thewestchester/\n103 Prince Street,New York,NY,10012,Apple Store SoHo,(212) 226-3126,Example Group 2,http://www.apple.com/retail/soho/'
	};
	var textareaFilename = textareaFilename;	// internal use only

	// State - don't touch!
	var scrolledToDemoOnce = false;
	var rowCounts = {}, errCounts = {}, finished = 0, queued = 0;
	var start, end;



	prepareDemo();

	// Smooth in-page scrolling; thanks to css-tricks.com
	$('body').on('click', 'a[href^=#]:not([href=#])', function()
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
			return suppress(event);
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
				rowCounts[textareaFilename] = 0;
				errCounts[textareaFilename] = 0;

				if (!input)
				{
					statusErr("** Nothing to parse - please provide input **");
					$('#input').focus();
					return done(textareaFilename);
				}

				if (!bigCheck(input))
				{
					statusErr("** Parsing aborted - recommend streaming large strings **");
					return done(textareaFilename);
				}

				status("Parsing text...");

				$('#output').empty();

				perfStart();
				var data = $.parse(input, userConfig());
				perfEnd();

				if (is('stream'))
				{
					var baseMsg = "Finished parsing " + rowCounts[textareaFilename] + " rows of data in <b>" + perfResult() + "</b> with <b>" + errCounts[textareaFilename] + " errors</b>.";
					if (errCounts[textareaFilename] == 0)
						statusGood("&#10003; " + baseMsg);
					else	
						statusErr("x " + baseMsg);
					status("(Only the end of the stream renders below.)");
					render(data);
				}
				else
				{
					var out = "Finished in <b>" + perfResult() + "</b> with <b>" + data.errors.length + " errors</b>.";
					if (data.errors.length == 0)
						statusGood("&#10003; " + out);
					else
						statusErr("x " + out);
					render(data);
				}

				done(textareaFilename);
			}
			else
			{
				// PARSE FILE(S)

				queued = $('#file')[0].files.length;

				$('#file').parse(
				{
					before: function(file, inputElem)
					{
						rowCounts[file.name] = 0;
						errCounts[file.name] = 0;

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

						var baseMsg = "Parsed <b>" + file.name + "</b> containing <b>" + rowCounts[file.name] + " rows</b> in <b>" + perfResult() + "</b> with <b>" + errCounts[file.name] + " errors</b>.";

						if (!is('stream'))
						{
							if (errCounts[file.name] == 0)
								statusGood("&#10003; " + baseMsg);
							else
								statusErr("x " + baseMsg);
						}
						else
						{
							if (errCounts[file.name] == 0)
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
		rowCounts[filename] = 0;
		errCounts[filename] = 0;
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
		if (!file)
			file = { name: textareaFilename };
		rowCounts[file.name]++;
		errCounts[file.name] += data.errors.length;
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
			$('#input').val(textDemos[$(this).data('demo')]);
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