jquery.parse
============

Robust, efficient CSV parsing (with nearly any delimiting character)


Basic usage
-----------

```javascript
results = $.parse(csvString, {
	delimiter: "\t",
	header: true
});
```

The default delimiter is `,` but can be set to anything anything except `"` or `\n`.

By default, a header row is expected. The output and error handling depends on whether you include a header row with your data.

**If `header: true`, the output looks like:**

```javascript
{
	errors: [
		// errors, if any (parsing should not throw exceptions)
	],
	results: {
		fields: [
			// field names from the header row
		],
		rows: [
			// objects, where each field value is keyed to the field name
		]
	}
}
```


**If `header: false`, the output looks like:**

```javascript
{
	errors: [
		// errors, if any (parsing should not throw exceptions)
	],
	results: [
		// each row is itself an array of values separated by delimiter
	]
}
```

**Errors look like:**

```javascript
{
	message: "",	// Human-readable message
	line: 0,		// Line of original input
	row: 0,			// Row index where error was
	index: 0		// Character index within original input
}
```