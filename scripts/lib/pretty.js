/**
 * # prettyPrinter
 *
 * libbash style formatting in node. Bash and JS are fundamentally different, so this is pretty
 * basic and you have to handle padding manually.
 *
 */

require('colours');

/**
 * Pad a string on the left with `n` spaces.
 * @param  {Number} n Number of spaces to prepend.
 * @return {String}   Padded string.
 */

function pad(n) {
	return (new Array(n || 0 + 1)).join(' ');
}

var log = console.log;


/**
 * Wrap a sting with visual chrome above and below. Automatic length.
 *
 * @param  {String}          basic      A basic string to wrap. No whitespace padding needed.
 * @param  {String}          chromeChar A character to use for the chrome.
 * @param  {String}          special    A special character to come before basic.
 * @param  {Number}          padding    Spaces to pad from the left margin.
 * @param  {String|String[]} innerstyle A string corresponding to a style provided by the `color` package, or an array of such strings. This styles the content.
 * @param  {String|String[]} outerstyle A string corresponding to a style provided by the `color` package, or an array of such strings. This styles the chrome.
 * @return {String}                     Resultant string.
 */

exports.chromify = function (basic, chromeChar, special, padding, innerstyle, outerstyle) {
	var padded = padding ? (new Array(padding + 1)).join(' ') : '';
	var simple = special && special.length ? special + '  ' + basic : basic;

	var maxLength = Math.max.apply(null, simple.split('\n').map(function (subString) {
		return subString.length;
	})) + padded.length;

	var chrome = (new Array(maxLength + 3)).join(chromeChar);

	if (Array.isArray(outerstyle)) {
		outerstyle.forEach(function (style) {
			chrome = chrome[style];
		});
	}

	if (typeof outerstyle === 'string') {
		chrome = chrome[outerstyle];
	}

	if (Array.isArray(innerstyle)) {
		innerstyle.forEach(function (style) {
			simple = simple[style];
		});
	}

	if (typeof innerstyle === 'string') {
		simple = simple[innerstyle];
	}

	return '\n' +  chrome + '\n ' + padded + simple.replace(/\n/g, '\n' + padded) + '\n' + chrome + '\n';
};


/**
 * H1 heading format.
 *
 * @param {String} content Content to format and log.
 * @param {String} special A special character to use as a marker before the heading text.
 */

exports.h1 = function (content, special) {
	log(exports.chromify(content, '❖', special, 0, ['bold', 'blue'], 'blue') + '\n');
};


/**
 * H2 heading format.
 *
 * @param  {String} content Content to format and log.
 */

exports.h2 = function (content) {
	log(('‣ ' + content).blue.bold + '\n');
};


/**
 * H3 heading format.
 *
 * @param  {String} content Content to format and log.
 */

exports.h3 = function (content) {
	log(('-- ' + content).blue.bold + '\n');
};


/**
 * H4 heading format.
 *
 * @param  {String} content Content to format and log.
 */

exports.h4 = function (content) {
	log(('◦◦◦ ' + content).blue.bold + '\n');
};


/**
 * H5 heading format.
 *
 * @param  {String} content Content to format and log.
 */

exports.h5 = function (content) {
	log(('◘◘◘◘ ' + content).blue.bold + '\n');
};


/**
 * Information format.
 *
 * @param {String} content Content to format and log.
 * @param {Number} padding Spaces to pad from the left margin.
 */

exports.info = function (content, padding, specialChar) {
	var c = specialChar || '⚀';
	log((pad(padding) + c + ' ' + content).grey);
};


/**
 * Warning format.
 *
 * @param {String} content Content to format and log.
 * @param {Number} padding Spaces to pad from the left margin.
 */

exports.warning = function (content, padding) {
	log((pad(padding) + '⧫  ' + content).yellow.bold);
};


/**
 * Error format.
 *
 * @param {String} content Content to format and log.
 * @param {Number} padding Spaces to pad from the left margin.
 */

exports.error = function (content, padding) {
	console.error((pad(padding) + '✘  ' + content).red.bold);
};


/**
 * Ok format.
 *
 * @param {String} content Content to format and log.
 * @param {Number} padding Spaces to pad from the left margin.
 */

exports.ok = function (content, padding) {
	log((pad(padding) + '✔  ' + content).green.bold);
};
