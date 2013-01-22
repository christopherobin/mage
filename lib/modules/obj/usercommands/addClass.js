var mage = require('../../../mage');

exports.params = ['name', 'weight', 'data'];

exports.execute = function (state, name, weight, data, cb) {

	mage.obj.addClass(state, name, weight, data, function (err, ident) {
		if (err) {
			return cb(err);
		}
		if (ident) {
			state.respond(ident);
		}
		cb();
	});

};