Parse CSV with JavaScript
========================================

## This project needs a maintainer. Issues have been disabled until someone volunteers to take lead of the project. If you need help with it, try [Stack Overflow](http://stackoverflow.com/questions/tagged/papaparse).

Author's note:

-------------

*As you probably know, life is busy, and it's taking me to other fields of research and development.*

*Papa Parse has been an incredible journey and I've learned a lot while I was developing it. It has served tens of thousands of developers and millions of end users. Wikipedia, the United Nations, various national and state governments around the world, academic institutions, research teams, and other non-profits---not to mention commercial entities---all use (or have used) Papa Parse to some extent for data processing. They use Papa Parse because it's the fastest correct CSV parser for the browser and the easiest to use, with the most advanced performance features for big files. I'm really happy with that.*

*I've begun graduate school and will spend about two years on my masters degree. That, along with [Caddy](https://github.com/mholt/caddy), will keep me occupied during my work day in the foreseeable future.*

*While I'm not relinquishing ownership of this project, who would like to take over in leading its development? Respond to issues and pull requests, deploy new releases, implement bug fixes -- keep it maintained.*

*Preferably somebody who has some experience with managing open source projects... this one is a little big for a brand new entrant, I feel... bonus points if you have a passion about high-performance CSV parsing.* 😄

*The new lead maintainer will of course be granted Collaborator status here and permission to publish to npm.*

*If there is more than one person interested in adopting this project, I'm sure the new lead maintainer would love to have some help. We can have multiple maintainers, but there should be one lead maintainer.*

*[Email me](https://matt.chat) if you are interested in becoming the lead maintainer of Papa Parse. It would help if you explain why and what plans you have for it or what you'd like to accomplish, what your priorities are, etc. Doesn't have to be fancy; just has to gain my trust*. 😉

*Thank you for using Papa Parse.*

-------------



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
- Optional jQuery integration to get files from `<input type="file">` elements

Papa Parse has **no dependencies** - not even jQuery.


Homepage & Demo
----------------

- [Homepage](http://papaparse.com)
- [Demo](http://papaparse.com/demo)

To learn how to use Papa Parse:

- [Documentation](http://papaparse.com/docs)


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

Otherwise, Baby Parse has nearly all the same functionality as Papa Parse 4.0, including the `unparse()` utility.


Get Started
-----------

Use [papaparse.min.js](https://github.com/mholt/PapaParse/blob/master/papaparse.min.js) for production.

For usage instructions, see the [homepage](http://papaparse.com) and, for more detail, the [documentation](http://papaparse.com/docs).



Tests
-----

Papa Parse is under test. Download this repository, run `npm install`, then `npm test` to run the tests in your browser.



Contributing
------------

To discuss a new feature or ask a question, open an issue. To fix a bug, submit a pull request to be credited with the [contributors](https://github.com/mholt/PapaParse/graphs/contributors)! Remember, a pull request, *with test*, is best. You may also discuss on Twitter with [#PapaParse](https://twitter.com/search?q=%23PapaParse&src=typd&f=realtime) or directly to me, [@mholt6](https://twitter.com/mholt6).
