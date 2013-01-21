var mage = require('../../../mage');

exports.params = ['id'];

exports.execute = function (state, id, cb) {
	mage.shop.delItemObject(state, id, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
