var mage = require('../../../mage');

exports.params = ['id', 'data'];

exports.execute = function (state, id, data, cb) {
	mage.shop.editItemObject(state, id, data, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
