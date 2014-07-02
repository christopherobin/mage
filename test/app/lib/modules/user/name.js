var assert = require('assert');

var MIN_LENGTH = 1;
var MAX_LENGTH = 50;

function check(name) {
	assert.equal(typeof name, 'string', 'invalidName');
	assert(name.length <= MAX_LENGTH && name.length >= MIN_LENGTH, 'invalidName');
}

exports.set = function (tUser, name) {
	check(name);

	tUser.name.assign(name);
};
