/**
 * # prettyPrinter
 *
 * libbash style formatting in node. Bash and JS are fundamentally different, so this is pretty
 * basic and you have to handle padding manually.
 *
 */

require('colours');
var EOL = require('os').EOL;

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
 * @param  {String|String[]} innerstyle A string corresponding to a style provided by the `color` package, or an array of such strings. This styles the content.
 * @param  {String|String[]} outerstyle A string corresponding to a style provided by the `color` package, or an array of such strings. This styles the chrome.
 */

exports.chromify = function (basic, chromeChar, innerstyle, outerstyle) {
	var maxLength = Math.max.apply(null, basic.split(EOL).map(function (subString) {
		return subString.length;
	}));

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
			basic = basic[style];
		});
	}

	if (typeof innerstyle === 'string') {
		basic = basic[innerstyle];
	}

	log(EOL + chrome + EOL + ' ' + basic.replace(new RegExp(EOL, 'g'), EOL + ' ') + EOL + chrome + EOL + EOL);
};


/**
 * H1 heading format.
 *
 * @param {String} content Content to format and log.
 */

exports.h1 = function (content) {
	exports.chromify(content, '❖', ['bold', 'blue'], 'blue');
};


/**
 * H2 heading format.
 *
 * @param  {String} content Content to format and log.
 */

exports.h2 = function (content) {
	log(('‣ ' + content).blue.bold + EOL);
};


/**
 * H3 heading format.
 *
 * @param  {String} content Content to format and log.
 */

exports.h3 = function (content) {
	log(('-- ' + content).blue.bold + EOL);
};


/**
 * H4 heading format.
 *
 * @param  {String} content Content to format and log.
 */

exports.h4 = function (content) {
	log(('◦◦◦ ' + content).blue.bold + EOL);
};


/**
 * H5 heading format.
 *
 * @param  {String} content Content to format and log.
 */

exports.h5 = function (content) {
	log(('◘◘◘◘ ' + content).blue.bold + EOL);
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
