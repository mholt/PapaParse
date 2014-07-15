var passCount = 0;
var failCount = 0;

$(function()
{
	// First, wireup!
	$('#results').on('click', 'td.rvl', function()
	{
		var tr = $(this).closest('tr');
		if (tr.hasClass('collapsed'))
		{
			$('.revealer', tr).hide();
			$('.hidden', tr).show();
			$(this).html("-");
		}
		else
		{
			$('.revealer', tr).show();
			$('.hidden', tr).hide();
			$(this).html("+");
		}
		tr.toggleClass('collapsed expanded');
	});

	$('#expand-all').click(function()
	{
		$('.collapsed .rvl').click();
	});

	$('#collapse-all').click(function()
	{
		$('.expanded .rvl').click();
	});



	// Next, run tests and render results!
	for (var i = 0; i < TESTS.length; i++)
	{
		var test = TESTS[i];
		var passed = runTest(test, i);
		if (passed)
			passCount++;
		else
			failCount++;
	}



	// Finally, show the overall status.
	if (failCount == 0)
		$('#status').addClass('status-pass').html("All <b>"+passCount+"</b> test"+(passCount == 1 ? "" : "s")+" passed");
	else
		$('#status').addClass('status-fail').html("<b>"+failCount+"</b> test"+(failCount == 1 ? "" : "s")+" failed; <b>"+passCount+"</b> passed");
});

function runTest(test, num)
{
	var actual = Papa.parse(test.input, test.config);

	var results = compare(actual.data, actual.errors, test.expected);

	var testDescription = (test.description || "");
	if (testDescription.length > 0)
		testDescription += '<br>';
	if (test.notes)
		testDescription += '<span class="notes">' + test.notes + '</span>';

	var tr = '<tr class="collapsed" id="test-'+num+'">'
			+ '<td class="rvl">+</td>'
			+ '<td>' + testDescription + '</td>'
			+ passOrFailTd(results.data)
			+ passOrFailTd(results.errors)
			+ '<td class="revealable pre"><div class="revealer">condensed</div><div class="hidden">' + JSON.stringify(test.config, null, 2) + '</div></td>'
			+ '<td class="revealable pre"><div class="revealer">condensed</div><div class="hidden">' + revealChars(test.input) + '</div></td>'
			+ '<td class="revealable pre"><div class="revealer">condensed</div><div class="hidden">data: ' + JSON.stringify(test.expected.data, null, 4) + '\r\nerrors: ' + JSON.stringify(test.expected.errors, null, 4) + '</div></td>'
			+ '<td class="revealable pre"><div class="revealer">condensed</div><div class="hidden">data: ' + JSON.stringify(actual.data, null, 4) + '\r\nerrors: ' + JSON.stringify(actual.errors, null, 4) + '</div></td>'
		   + '</tr>';

	$('#results').append(tr);

	if (!results.data.passed || !results.errors.passed)
		$('#test-'+num+' td.rvl').click();

	return results.data.passed && results.errors.passed
}

function compare(actualData, actualErrors, expected)
{
	var data = compareData(actualData, expected.data);
	var errors = compareErrors(actualErrors, expected.errors);
	return {
		data: data,
		errors: errors
	}
}

function compareData(actual, expected)
{
	var passed = true;

	if (actual.length != expected.length)
		passed = false;

	for (var row = 0; row < expected.length; row++)
	{
		if (actual.length != expected.length)
		{
			passed = false;
			break;
		}

		for (var col = 0; col < expected[row].length; col++)
		{
			if (actual[row].length != expected[row].length)
			{
				passed = false;
				break;
			}

			var expectedVal = expected[row][col];
			var actualVal = actual[row][col];

			if (actualVal !== expectedVal)
			{
				passed = false;
				break;
			}
		}
	}

	// We pass back an object right now, even though it only contains
	// one value, because we might add details to the test results later
	// (same with compareErrors below)
	return {
		passed: passed
	};
}

function compareErrors(actual, expected)
{
	var passed = JSON.stringify(actual) == JSON.stringify(expected);

	return {
		passed: passed
	};
}

function passOrFailTd(result)
{
	if (result.passed)
		return '<td class="ok">OK</td>';
	else
		return '<td class="fail">FAIL</td>';
}

function revealChars(txt)
{
	// Make spaces and tabs more obvious when glancing
	txt = txt.replace(/( |\t)/ig, '<span class="whitespace-char">$1</span>');

	txt = txt.replace(/(\r\n|\n\r|\r|\n)/ig, '<span class="whitespace-char special-char">$1</span>$1');

	// Now make the line breaks within the spans actually appear on the page
	txt = txt.replace(/">\r\n<\/span>/ig, '">\\r\\n</span>');
	txt = txt.replace(/">\n\r<\/span>/ig, '">\\n\\r</span>');
	txt = txt.replace(/">\r<\/span>/ig, '">\\r</span>');
	txt = txt.replace(/">\n<\/span>/ig, '">\\n</span>');

	return txt;
}