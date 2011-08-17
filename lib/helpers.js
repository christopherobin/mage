exports.strSlice = function (str, delim, count) {
	// like string.split, except that it does not leave out the last part of the delimited result
	// eg: strSlice('a.b.c.d', '.', 2) returns: ['a', 'b.c.d.']

	str = str.split(delim);

	var last = str.splice(count - 1);

	return str.concat(last.join(delim));
};


exports.randomInteger = function (low, high) {
	low = ~~low;
	high = ~~high + 1;

	return low + ~~(Math.random() * high - low);
};

