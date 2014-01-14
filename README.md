Parse CSV with Javascript
========================================

Papa Parse (formerly the jQuery Parse Plugin) is a robust and powerful CSV (character-separated values) parser with these features:

- Parses delimited text strings without any fuss
- Attach to `<input type="file">` elements to load and parse files from disk
- Automatically detects delimiter (or specify a delimiter yourself)
- Supports streaming large inputs
- Utilize the header row, if present
- Gracefully handles malformed data
- Optional dynamic typing so that numeric data is parsed as numbers
- Descriptive and contextual errors



Demo
----

Visit **[PapaParse.com](http://papaparse.com/#demo)** to give Papa a whirl!



Get Started
-----------

Use [jquery.parse.min.js](https://github.com/mholt/jquery.parse/blob/master/jquery.parse.min.js) for production.

For usage instructions, see the [homepage](http://papaparse.com) and, for more detail, the [documentation](http://papaparse.com/docs.html).



Tests
-----

The Parser component is under test. Download this repository and open `tests.html` in your browser to run them.



Contributing
------------

If you'd like to see a feature or bug fix, pull down the code and submit a pull request. But remember, if you're changing anything in the Parser function, a pull request, *with test*, is best. (All changes to the parser component should be validated with tests.) You may also open issues for discussion or join in on Twitter with [#PapaParse](https://twitter.com/search?q=%23PapaParse&src=typd&f=realtime)



Origins
-------

Papa Parse is the result of an experiment by [SmartyStreets](http://smartystreets.com) which matured into a fully-featured, independent jQuery plugin. Wanting to enhance the demo on their homepage, SmartyStreets looked into ways to simulate their list service. This involved processing at least part of a potentially large delimited text file. And what else? They wanted to do it without requiring a file upload (for simplicity and to alleviate privacy concerns). No suitable solutions were found, so they built their own. After finding it successful, the code was brought out into this jQuery plugin, now known as Papa Parse.
