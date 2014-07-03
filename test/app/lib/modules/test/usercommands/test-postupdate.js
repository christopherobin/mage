exports.access = 'user';

exports.params = [];

exports.execute = function (state, callback) {
	var myObj = { a: 5, b: 6 };
	state.respond(myObj);
	myObj.a += 1;
	return callback();
};
