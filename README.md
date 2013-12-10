Parse jQuery Plugin (jquery.parse)
==================================

Robust, efficient CSV parsing (supports custom delimiting characters). Malformed CSV files are especially common, and this parser is an attempt to handle parsing errors more robustly and parse CSV text more efficiently.

**[jsFIDDLE DEMO](http://jsfiddle.net/mholt/nCaee/)**

Most people will want to use the minified [jquery.parse.min.js](https://github.com/mholt/jquery.parse/blob/master/jquery.parse.min.js) file.

For debug and development, feel free to use the original [jquery.parse.js](https://github.com/mholt/jquery.parse/blob/master/jquery.parse.js) file.

This project is under test. Download this repository and open `tests.html` in your browser to run them.


Basic usage
-----------

The second argument is optional, but here it is with the defaults:

```javascript
results = $.parse(csvString, {
	delimiter: ",",
	header: true,
	dynamicTyping: true
});
```

### Config options

| Option            | Description
|------------------ | -----------------
| `delimiter`       | The delimiting character. Usually just a comma or tab. Can be set to anything anything except `"` or `\n`.
| `header`          | If true, interpret the first row of parsed data as a header column; fields are returned separately from the data, and data will be returned keyed to its field name. If false, the parser simply returns an array (list) of arrays (rows), including the first column.
| `dynamicTyping`   | If true, fields that are strictly numeric will be converted to a number type. If false, each parsed datum is returned as a string.

### Output

The output and error handling depends on whether you include a header row with your data. If you have a header, each row must have the same number of fields as the header row, or an error will be produced.

**Example input:**

    Item,SKU,Cost,Quantity
    Book,ABC1234,10.95,4
    Movie,DEF5678,29.99,3

**With header and dynamic typing:**

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
  "errors": []
}
```

**Without headers and without dynamic typing:**

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
  "errors": []
}
```

Errors
------

Here is the structure of an error:

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

(Assume again that the default config is used.) Suppose the input is malformed:

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
  "errors": [
    {
      "type": "FieldMismatch",
      "code": "TooFewFields",
      "message": "Too few fields; expected 4 fields, parsed 2",
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
  ]
}
```

If the header row is disabled, field counting does not occur, because there is no need to key the data to the field name:

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
  "errors": [
    {
      "type": "Quotes",
      "code": "MissingQuotes",
      "message": "Unescaped or mismatched quotes",
      "line": 2,
      "row": 1,
      "index": 66
    }
  ]
}
```

But you will still be notified about the stray quotes, as shown above.

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
  "errors": [
    {
      "type": "FieldMismatch",
      "code": "TooManyFields",
      "message": "Too many fields: expected 4 fields but parsed 5",
      "line": 2,
      "row": 0,
      "index": 43
    },
    {
      "type": "FieldMismatch",
      "code": "TooFewFields",
      "message": "Too few fields: expected 4 fields but parsed 5",
      "line": 2,
      "row": 0,
      "index": 43
    }
  ]
}
```

As you can see, any "extra" fields at the end, when using a header row, are simply tacked onto a special field named "__parsed_extra", in the order that the remaining line was parsed.



### Is jQuery needed?

Actually, no. Just pull out the `Parser` function [embedded in the plugin](https://github.com/mholt/jquery.parse/blob/master/jquery.parse.js#L46). The jQuery plugin merely wraps this function which has no jQuery dependencies.

I've packaged this as a jQuery plugin primarily for publicity and convenience. 
