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