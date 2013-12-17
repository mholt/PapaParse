Parse (jquery.parse) Plugin
===========================

The jQuery Parse plugin is a robust and efficient CSV (character-separated values) parser with these features:

- Parses delimited text strings without any fuss
- Attach to `<input type="file">` elements to load and parse files from disk
- Automatically detects delimiter (or specify a delimiter yourself)
- Header row support
- Gracefully handles malformed data
- Optional dynamic typing so that numeric data is parsed as numbers
- Descriptive and contextual errors



Demo
----

**[jsFIDDLE DEMO](http://jsfiddle.net/mholt/nCaee/)**

Or download the repository and open `index.html` in your browser.




Get Started
-----------

For production: [jquery.parse.min.js](https://github.com/mholt/jquery.parse/blob/master/jquery.parse.min.js)

For debug/dev: [jquery.parse.js](https://github.com/mholt/jquery.parse/blob/master/jquery.parse.js)



### Config object

Any time you invoke the parser, you may customize it using a "config" object. It supports these properties:

| Option              | Default | Description       
|-------------------- | ------- | ---------------
| **`delimiter`**     | ` `     | The delimiting character. Leave blank to auto-detect. If you specify a delimiter, it must be a string of length 1, and cannot be `\n`, `\r`, or `"`.
| **`header`**        | `true`  | If true, interpret the first row of parsed data as column titles; fields are returned separately from the data, and data will be returned keyed to its field name. Duplicate field names would be problematic. If false, the parser simply returns an array (list) of arrays (rows), including the first row.
| **`dynamicTyping`** | `true`  | If true, fields that are only numeric will be converted to a number type. If false, each parsed datum is returned as a string.
| **`preview`**       | `0`     | If preview > 0, only that many rows will be parsed.






### Parsing strings

To parse a delimited text string with default settings, simply do:

```javascript
var results = $.parse(csvString);
```

Or to customize the settings, pass in a config object with any properties you wish to change:

```javascript
var results = $.parse(csvString, {
  delimiter: "\t",
  header: false,
  dynamicTyping: false,
  preview: 10
});
```




### Parsing files

You can parse multiple files from multiple `<input type="file">` elements like so, where each property is optional:

```javascript
$('input[type=file]').parse({
  config: {
    // base settings to use for each file
  },
  before: function(file, inputElem)
  {
    // executed before parsing each file begins;
    // see documentation for how return values
    // affect the behavior of the plugin
  },
  error: function(err, file, inputElem)
  {
    // executed if an error occurs during loading the file,
    // or if the file being iterated is the wrong type,
    // or if the input element has no files selected
  },
  complete: function(results, file, inputElem, event)
  {
    // executed when parsing each file completes;
    // this function receives the parse results
  }
});
```

In order to be parsed, a file must have "text" in its MIME type.




#### Callbacks

As indicated above, there are callbacks you can use when parsing files.



##### `before(file, inputElem)`

If the next file in the queue is found to be some sort of "text" MIME type, this callback will be executed immediately before setting up the FileReader, loading the file, and parsing it. It receives the file object and the `<input>` element so you can inspect the file to be parsed.

You can change what happens next depending on what you return:

- Return `"skip"` to skip parsing this file.
- Return `false` to abort parsing this and all other files in the queue.
- Return a config object to alter the options for parsing this file only.

Returning anything else, including `undefined`, continues without any changes.


##### `error(err, file, inputElem)`

Invoked if there is an error loading the file. It receives an object that implements the [`DOMError`](https://developer.mozilla.org/en-US/docs/Web/API/DOMError) interface (i.e. call `err.name` to get the error), the file object at hand, and the `<input>` element from which the file was selected.

Errors can occur before reading the file if:

- the HTML element has no files chosen
- a file chosen is not a "text" type (e.g. "text/csv" or "text/plain")
- a user-defined callback function (`before`) aborted the process

Otherwise, errors are invoked by FileReader when opening the file. *Parse errors are not reported here, but are reported in the results later on.*


##### `complete(results, file, inputElem, event)`

Invoked when parsing a file completes. It receives the results of the parse (including errors), the file object, the `<input>` element from which the file was chosen, and the FileReader-generated event.




Output
------

Whether you're parsing strings or files, the results returned by the parser are the same since, under the hood, the FileReader loads a file as a string.

The results will always have this basic structure:

```javascript
{
  results:  // parse results
  errors:   // parse errors, keyed by row
}
```

If no delimiter is specified and a delimiter cannot be auto-detected, an error keyed by "config" will be produced, and a default delimiter will be chosen.

**Example input:**

    Item,SKU,Cost,Quantity
    Book,ABC1234,10.95,4
    Movie,DEF5678,29.99,3


### Results if `header: true` and `dynamicTyping: true`

With a header row, each value is keyed to its field name, so the result is an object with `fields` and `rows`. The fields are an array of strings, and the rows are an array of objects:

```json
{
  "results": {
    "fields": [
      "Item",
      "SKU",
      "Cost",
      "Quantity"
    ],
    "rows": [
      {
        "Item": "Book",
        "SKU": "ABC1234",
        "Cost": 10.95,
        "Quantity": 4
      },
      {
        "Item": "Movie",
        "SKU": "DEF5678",
        "Cost": 29.99,
        "Quantity": 3
      }
    ]
  },
  "errors": {
    "length": 0
  }
}
```

Notice how the numeric values were converted to numbers. That is what `dynamicTyping` does.

With a header row, the field count must be the same on each row, or a FieldMismatch error will be produced for that row. (Without a header row, lines can have variable number of fields without errors.)


### Results if `header: false` and `dynamicTyping: false`

Without a header row, the result is an array (list) of arrays (rows).

```json
{
  "results": [
    [
      "Item",
      "SKU",
      "Cost",
      "Quantity"
    ],
    [
      "Book",
      "ABC1234",
      "10.95",
      "4"
    ],
    [
      "Movie",
      "DEF5678",
      "29.99",
      "3"
    ]
  ],
  "errors": {
    "length": 0
  }
}
```

Notice how, since dynamic typing is disabled, the numeric values are strings.

If you are concerned about optimizing the performance of the parser, disable dynamic typing. That should speed things up by at least 2x.


Parse Errors
------------

Parse errors are returned alongside the results as an array of objects. Here is the structure of an error object:

```javascript
{
  type: "",     // Either "Quotes" or "FieldMismatch"
  code: "",     // Standardized error code like "UnexpectedQuotes"
  message: "",  // Human-readable error details
  line: 0,      // Line of original input
  row: 0,       // Row index of parsed data where error is
  index: 0      // Character index within original input
}
```

Assuming the default settings, suppose the input is malformed:

    Item,SKU,Cost,Quantity
    Book,"ABC1234,10.95,4
    Movie,DEF5678,29.99,3

Notice the stray quotes on the second line. This is the output:

```json
{
  "results": {
    "fields": [
      "Item",
      "SKU",
      "Cost",
      "Quantity"
    ],
    "rows": [
      {
        "Item": "Book",
        "SKU": "ABC1234,10.95,4\nMovie,DEF5678,29.99,3"
      }
    ]
  },
  "errors": {
    "0": [
      {
        "type": "FieldMismatch",
        "code": "TooFewFields",
        "message": "Too few fields: expected 4 fields but parsed 2",
        "line": 2,
        "row": 0,
        "index": 66
      },
      {
        "type": "Quotes",
        "code": "MissingQuotes",
        "message": "Unescaped or mismatched quotes",
        "line": 2,
        "row": 0,
        "index": 66
      }
    ],
    "length": 2
  }
}
```

If the header row is disabled, field counting does not occur because there is no need to key the data to the field name. Thus we only get a Quotes error:

```json
{
  "results": [
    [
      "Item",
      "SKU",
      "Cost",
      "Quantity"
    ],
    [
      "Book",
      "ABC1234,10.95,4\nMovie,DEF5678,29.99,3"
    ]
  ],
  "errors": {
    "1": [
      {
        "type": "Quotes",
        "code": "MissingQuotes",
        "message": "Unescaped or mismatched quotes",
        "line": 2,
        "row": 1,
        "index": 66
      }
    ],
    "length": 1
  }
}
```

Suppose a field value with a delimiter is not escaped:

    Item,SKU,Cost,Quantity
    Book,ABC1234,10,95,4
    Movie,DEF5678,29.99,3

Again, notice the second line, "10,95" instead of "10.95". This field *should* be quoted: `"10,95"` but the parser handles the problem gracefully:

```json
{
  "results": {
    "fields": [
      "Item",
      "SKU",
      "Cost",
      "Quantity"
    ],
    "rows": [
      {
        "Item": "Book",
        "SKU": "ABC1234",
        "Cost": 10,
        "Quantity": 95,
        "__parsed_extra": [
          "4"
        ]
      },
      {
        "Item": "Movie",
        "SKU": "DEF5678",
        "Cost": 29.99,
        "Quantity": 3
      }
    ]
  },
  "errors": {
    "0": [
      {
        "type": "FieldMismatch",
        "code": "TooManyFields",
        "message": "Too many fields: expected 4 fields but parsed 5",
        "line": 2,
        "row": 0,
        "index": 43
      }
    ],
    "length": 1
  }
}
```

Since files with headers are supposed to have the same number of fields per row, any extra fields are parsed into a special array field named "__parsed_extra" in the order that the remaining line was parsed.



Tests
-----

The Parser component is under test. Download this repository and open `tests.html` in your browser to run them.



The Parser function
-------------------

Inside this jQuery plugin is a `Parser` function that performs the parsing of delimited text. It does not depend upon jQuery. This plugin uses jQuery to attach to `<input type="file">` elements and to make it more convenient to activate and use the parsing mechanism.



Contributing
-------------------

Please feel free to chip in! If you'd like to see a feature or fix, pull down the code and submit a pull request. But remember, if you're changing anything in the Parser function, a pull request, *with test*, is best. (All changes to the parser component should be validated with tests.)