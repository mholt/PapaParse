Parse CSV with Javascript
========================================

[![mholt on Gittip](http://img.shields.io/badge/tips-accepted-brightgreen.svg?style=flat)](https://www.gittip.com/mholt/)

Papa Parse (formerly the jQuery Parse Plugin) is a robust and powerful CSV (character-separated values) parser with these features:

- Easy to use
- Parse CSV files directly (local or over the network)
- Stream large files (even via HTTP)
- Reverse parsing (converts JSON to CSV)
- Auto-detects the delimiter
- Worker threads to keep your web page responsive
- Header row support
- Can convert numbers and booleans to their types
- Graceful and robust error handling
- Minor jQuery integration to get files from `<input type="file">` elements

All are optional (except for being easy to use).



[Demo](http://papaparse.com/demo.html)
----

Visit **[PapaParse.com/demo.html](http://papaparse.com/demo.html)** to try Papa!



Get Started
-----------

Use [papaparse.min.js](https://github.com/mholt/PapaParse/blob/master/papaparse.min.js) for production.

For usage instructions, see the [homepage](http://papaparse.com) and, for more detail, the [documentation](http://papaparse.com/docs.html).



Tests
-----

Papa Parse is under test (especially its core Parser). Download this repository and open `tests/tests.html` in your browser to run them.



Contributing
------------

To discuss a new feature or ask a question, open an issue. To fix a bug, submit a pull request to be credited with the [contributors](https://github.com/mholt/PapaParse/graphs/contributors)! Remember, a pull request, *with test*, is best. (Especially all changes to the Parser component should be validated with tests.) You may also discuss on Twitter with [#PapaParse](https://twitter.com/search?q=%23PapaParse&src=typd&f=realtime) or directly to me, [@mholt6](https://twitter.com/mholt6).



Origins
-------

Papa Parse is the result of a successful experiment by [SmartyStreets](http://smartystreets.com) which matured into a fully-featured, independent Javascript library.
