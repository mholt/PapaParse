Baby Parse
=========

Fast and reliable CSV parser based on [Papa Parse](http://papaparse.com). Papa Parse is for the browser, Baby Parse is for Node.js.

This package has all the functionality of Papa Parse except for web workers and parsing directly from files. You can pass a string to Baby Parse and use any of the other config options as described in the [Papa Parse documentation](http://papaparse.com/docs).

Basic Usage
-----

```js
// pass in the contents of a csv file
parsed = Baby.parse(csv);

// voila
rows = parsed.data;
```

For a complete understanding of the power of this library, please refer to the [Papa Parse web site](http://papaparse.com).


Credits
-------

Rich Harris forked Papa Parse to make Baby Parse. [Matt Holt](https://twitter.com/mholt6) (the author of Papa Parse) helps maintain this fork.


License
-------

The original PapaParse is MIT licensed. So is BabyParse.
