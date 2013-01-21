var mage = require('../../../mage');

exports.params = ['ids'];

exports.execute = function (state, ids, cb) {
	mage.shop.delItemObjects(state, ids, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
