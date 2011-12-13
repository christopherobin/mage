var mithril = require('../../../mithril');

exports.params = ['identifier', 'type', 'data'];

exports.execute = function (state, identifier, type, data, cb) {

	// params = { prefix: 'gacha:', type: 'gacha_free', data: { priority: 4, name: 'blah, hours: [[], []], recurring: [{}, {}]  } };   'ish
	mithril.shop.editShop(state, identifier, type, data, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
