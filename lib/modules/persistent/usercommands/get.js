var mage = require('../../../mage');


exports.params = ['properties', 'removeAfterGet'];


exports.execute = function (state, properties, removeAfterGet, cb) {
	mage.persistent.get(state, properties, removeAfterGet, function (error, data) {
		if (!error) {
			state.respond(data);
		}

		cb();
	});
};

