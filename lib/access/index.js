/**
 * A list of levels, order from weak credentials to strong credentials at the end.
 *
 * @type {Array}
 */

var levelsList = [
	'anonymous',
	'user',
	'admin'
];

/**
 * A map of levels, where the value is the index of that same level in the levelsList.
 * The higher the number, the stronger the credentials should be considered.
 *
 * @type {{anonymous: number, user: number, admin: number}}
 */

var levelsMap = {
	anonymous: 0,
	user: 1,
	admin: 2
};


exports.getHighestLevel = function () {
	return levelsList[levelsList.length - 1];
};


exports.getLevels = function () {
	return levelsList.slice();
};


/**
 * Returns positive if a is stronger, negative if b is stronger, or 0 if a and b are equal
 *
 * @param a {string}
 * @param b {string}
 * @returns {number}
 */

exports.compare = function (a, b) {
	return levelsMap[a] - levelsMap[b];
};
