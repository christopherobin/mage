var mithril = require('../../../mithril');

exports.execute = function (state, params, cb) {

	// params = { prefix: 'gacha:', type: 'gacha_free', data: { priority: 4, name: 'blah, hours: [[], []], recurring: [{}, {}]  } };   'ish
	mithril.shop.addShop(state, params, function (errors, shopIdent) {
		if (errors) { return cb(errors); }

		state.respond(shopIdent);
		cb();
	});
};
