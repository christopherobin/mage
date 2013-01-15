var mage = require('../../../mage');


exports.params = [];


exports.execute = function (state, cb) {
	mage.persistent.getAll(state, function (error, data) {
		if (!error) {
			state.respond(data);
		}

		cb();
	});
};

