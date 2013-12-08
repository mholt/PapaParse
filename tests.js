var passCount = 0, failCount = 0;
var passing = "passing";
var failing = "failing"

var resultSet1 = [
	{
		config: { delimiter: ",", header: true, dynamicTyping: true },
		expected: {
		  "results": {
		    "fields": [
		      "F1",
		      "F2",
		      "F3"
		    ],
		    "rows": [
		      {
		        "F1": "V1",
		        "F2": 2,
		        "F3": "V3"
		      }
		    ]
		  },
		  "errors": []
		}
	},
	{
		config: { delimiter: ",", header: false, dynamicTyping: true },
		expected: {
		  "results": [
		    [
		      "F1",
		      "F2",
		      "F3"
		    ],
		    [
		      "V1",
		      2,
		      "V3"
		    ]
		  ],
		  "errors": []
		}
	},
	{
		config: { delimiter: ",", header: false, dynamicTyping: false },
		expected: {
		  "results": [
		    [
		      "F1",
		      "F2",
		      "F3"
		    ],
		    [
		      "V1",
		      "2",
		      "V3"
		    ]
		  ],
		  "errors": []
		}
	},
	{
		config: { delimiter: ",", header: true, dynamicTyping: false },
		expected: {
		  "results": {
		    "fields": [
		      "F1",
		      "F2",
		      "F3"
		    ],
		    "rows": [
		      {
		        "F1": "V1",
		        "F2": "2",
		        "F3": "V3"
		      }
		    ]
		  },
		  "errors": []
		}
	}
];

var tests = [
	{
		input: "F1,F2,F3\nV1,2,V3",
		cases: resultSet1
	},
	{
		input: "F1,F2,F3\r\nV1,2,V3",
		cases: resultSet1
	},
	{
		input: "F1,\"F2\",F3\r\nV1,2,\"V3\"",
		cases: resultSet1
	},
	{
		input: "F1,F2,F3\n\nV1,2,V3",
		cases: resultSet1
	},
	{
		input: "F1,F2,F3\r\n\r\nV1,2,V3",
		cases: resultSet1
	},
	{
		input: "F1,F2,F3\r\n \r\nV1,2,V3",
		cases: resultSet1
	},
	{
		input: "F1,F2,F3\nV1,2,V3\nV4,V5,V6",
		cases: [
			{
				config: { delimiter: ",", header: true, dynamicTyping: true },
				expected: {
				  "results": {
				    "fields": [
				      "F1",
				      "F2",
				      "F3"
				    ],
				    "rows": [
				      {
				        "F1": "V1",
				        "F2": 2,
				        "F3": "V3"
				      },
				      {
				        "F1": "V4",
				        "F2": "V5",
				        "F3": "V6"
				      }
				    ]
				  },
				  "errors": []
				}
			},
			{
				config: { delimiter: ",", header: false, dynamicTyping: true },
				expected: {
				  "results": [
				    [
				      "F1",
				      "F2",
				      "F3"
				    ],
				    [
				      "V1",
				      2,
				      "V3"
				    ],
				    [
				      "V4",
				      "V5",
				      "V6"
				    ]
				  ],
				  "errors": []
				}
			},
			{
				config: { delimiter: ",", header: false, dynamicTyping: false },
				expected: {
				  "results": [
				    [
				      "F1",
				      "F2",
				      "F3"
				    ],
				    [
				      "V1",
				      "2",
				      "V3"
				    ],
				    [
				      "V4",
				      "V5",
				      "V6"
				    ]
				  ],
				  "errors": []
				}
			},
			{
				config: { delimiter: ",", header: true, dynamicTyping: false },
				expected: {
				  "results": {
				    "fields": [
				      "F1",
				      "F2",
				      "F3"
				    ],
				    "rows": [
				      {
				        "F1": "V1",
				        "F2": "2",
				        "F3": "V3"
				      },
				      {
				        "F1": "V4",
				        "F2": "V5",
				        "F3": "V6"
				      }
				    ]
				  },
				  "errors": []
				}
			}
		]
	},
	{
		input: "F1,F2,F3\n,2,V3\nV4,V5,V6",
		cases: [
			{
				config: { delimiter: ",", header: true, dynamicTyping: true },
				expected: {
				  "results": {
				    "fields": [
				      "F1",
				      "F2",
				      "F3"
				    ],
				    "rows": [
				      {
				        "F1": "",
				        "F2": 2,
				        "F3": "V3"
				      },
				      {
				        "F1": "V4",
				        "F2": "V5",
				        "F3": "V6"
				      }
				    ]
				  },
				  "errors": []
				}
			}
		]
	},
];

$(function()
{
	var counter = 0;
	for (var i = 0; i < tests.length; i++)
	{
		var test = tests[i];
		var input = test.input;
		for (var j = 0; j < test.cases.length; j++)
		{
			counter++;
			var testCase = test.cases[j];
			var actual = doTest(input, testCase.config);
			var status = equal(actual, testCase.expected) ? passing : failing;
			render(input, testCase.expected, actual, testCase.config, counter, status);
		}
	}

	$('#pass-count').text(passCount);
	$('#fail-count').text(failCount);
});

function doTest(input, config)
{
	return $.parse(input, config);
}

function render(input, expected, actual, config, count, status)
{
	if (status == passing)
		passCount++;
	else
		failCount++;

	var html =	'<tr>' +
				'<td class="count">'+count+'</td>' +
				'<td class="input"><code>'+string(input)+'</code></td>' +
				'<td class="config"><code>'+string(config)+'</code></td>' +
				'<td class="output"><code>'+string(expected)+'</code></td>' +
				'<td class="output '+status+'"><code>'+string(actual)+'</code></td>' +
				'</tr>';
	$('#results').append(html);
}

function string(obj)
{
	return typeof obj === "string" ? obj : JSON.stringify(obj, undefined, 2);
}

function equal(actual, expected)
{
	return string(actual) === string(expected);
}