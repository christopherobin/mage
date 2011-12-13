var mithril = require('../../../mithril');

exports.params = ['id', 'data'];

exports.execute = function (state, id, data, cb) {
	mithril.shop.editItemObject(state, id, data, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
