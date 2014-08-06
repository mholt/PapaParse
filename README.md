BabyParse
=========

I needed a really fast and reliable CSV parser. [PapaParse.com](http://papaparse.com/#demo) is the best one I've come across yet. But it's wrapped up as a jQuery plugin like it's 2006 or something :P

So I stripped out the actual parsing bit and made it Node/AMD compatible, so that I could drop it into non-jQuery projects. The code hasn't been touched other than that - I think there's a load of logic for handling streams and whatnot. I honestly don't know and can't be bothered to look. It seems pretty decent. In the project I'm working on now it was an order of magnitude quicker than the thicket of regex hacks it replaced.

Don't thank me, thank [@mholt](https://github.com/mholt). (Thanks Matt!)



Usage
-----

```js
// pass in the contents of a csv file
parsed = Baby.parse( csv );

// voila
rows = parsed.data;
```


License
-------

The original PapaParse is MIT licensed. So is BabyParse.
