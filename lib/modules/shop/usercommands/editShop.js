var mithril = require('../../../mithril');

exports.execute = function (state, params, cb) {

	// params = { prefix: 'gacha:', type: 'gacha_free', data: { priority: 4, name: 'blah, hours: [[], []], recurring: [{}, {}]  } };   'ish
	mithril.shop.editShop(state, params, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
