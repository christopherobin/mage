var mage = require('mage');

exports.access = 'admin';
exports.params = ['userId'];

exports.execute = function (state, userId, cb) {
	mage.ident.unban(state, userId, function (error) {
		if (error) {
			return state.error(error.message || error, error, cb);
		}

		state.respond();
		cb();
	});
};
