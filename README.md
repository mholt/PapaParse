Parse CSV with Javascript
========================================

[![mholt on Gratipay](http://img.shields.io/badge/tips-accepted-brightgreen.svg?style=flat)](https://www.gratipay.com/mholt/)

Papa Parse is the [fastest](http://jsperf.com/javascript-csv-parsers/4) in-browser CSV (or delimited text) parser for JavaScript. It is reliable and correct according to [RFC 4180](https://tools.ietf.org/html/rfc4180), and it comes with these features:

- Easy to use
- Parse CSV files directly (local or over the network)
- Fast mode ([is really fast](http://jsperf.com/javascript-csv-parsers/3))
- Stream large files (even via HTTP)
- Reverse parsing (converts JSON to CSV)
- Auto-detect delimiter
- Worker threads to keep your web page reactive
- Header row support
- Pause, resume, abort
- Can convert numbers and booleans to their types
- Small jQuery integration to get files from `<input type="file">` elements

Papa Parse has **no dependencies** - not even jQuery.


Homepage & Demo
----------------

- [Homepage](http://papaparse.com)
- [Demo](http://papaparse.com/demo)

To learn how to use Papa Parse:

- [Documentation](http://papaparse.com/docs)


Papa Parse for Node
--------------------

[Rich Harris](https://github.com/Rich-Harris) forked this project to make **[Baby Parse](https://github.com/Rich-Harris/BabyParse)** which runs in Node.js environments. However, it is using an older version of the parser which is very slow and has some bugs.

```bash
$ npm install babyparse
```

[Baby Parse on npm registry](https://www.npmjs.org/package/babyparse)

Use it just like Papa Parse. However:

- It is not up to date with the latest parser, so it is slower and has bugs.
- Files are not supported; strings only (you can use Node's file facilities to load file contents yourself)
- Some config options are unavailable:
	- worker
	- download (you can use Node's network facilities to download files yourself)
	- encoding
	- chunk

Otherwise, Baby Parse has nearly all the same functionality as Papa Parse 3.0, including the `unparse()` function.


Get Started
-----------

Use [papaparse.min.js](https://github.com/mholt/PapaParse/blob/master/papaparse.min.js) for production.

For usage instructions, see the [homepage](http://papaparse.com) and, for more detail, the [documentation](http://papaparse.com/docs).



Tests
-----

Papa Parse is under test. Download this repository and open `tests/tests.html` in your browser to run them.



Contributing
------------

To discuss a new feature or ask a question, open an issue. To fix a bug, submit a pull request to be credited with the [contributors](https://github.com/mholt/PapaParse/graphs/contributors)! Remember, a pull request, *with test*, is best.You may also discuss on Twitter with [#PapaParse](https://twitter.com/search?q=%23PapaParse&src=typd&f=realtime) or directly to me, [@mholt6](https://twitter.com/mholt6).
