Parse CSV with Javascript
========================================

[![mholt on Gratipay](http://img.shields.io/badge/tips-accepted-brightgreen.svg?style=flat)](https://www.gratipay.com/mholt/)

Papa Parse (formerly the jQuery Parse Plugin) is a robust and powerful CSV (character-separated values) parser with these features:

- Easy to use
- Parse CSV files directly (local or over the network)
- Stream large files (even via HTTP)
- Reverse parsing (converts JSON to CSV)
- Auto-detect the delimiter
- Worker threads to keep your web page reactive
- Header row support
- Pause, resume, abort
- Can convert numbers and booleans to their types
- Graceful and robust error handling
- Minor jQuery integration to get files from `<input type="file">` elements

Papa Parse has **no dependencies** - not even jQuery.


Homepage & Demo
----------------

- [Homepage](http://papaparse.com)
- [Demo](http://papaparse.com/demo.html)


Papa Parse for Node
--------------------

[Rich Harris](https://github.com/Rich-Harris) forked this project to make **[Baby Parse](https://github.com/Rich-Harris/BabyParse)** which runs in Node.js environments.

```bash
$ npm install babyparse
```

[Baby Parse on npm registry](https://www.npmjs.org/package/babyparse)

Use it just like Papa Parse. However:

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

For usage instructions, see the [homepage](http://papaparse.com) and, for more detail, the [documentation](http://papaparse.com/docs.html).



Tests
-----

Papa Parse is under test. Download this repository and open `tests/tests.html` in your browser to run them.



Contributing
------------

To discuss a new feature or ask a question, open an issue. To fix a bug, submit a pull request to be credited with the [contributors](https://github.com/mholt/PapaParse/graphs/contributors)! Remember, a pull request, *with test*, is best.You may also discuss on Twitter with [#PapaParse](https://twitter.com/search?q=%23PapaParse&src=typd&f=realtime) or directly to me, [@mholt6](https://twitter.com/mholt6).



Origins
-------

Papa Parse is the result of a successful experiment by [SmartyStreets](http://smartystreets.com) which matured into an independent, fully-featured Javascript library.
