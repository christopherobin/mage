var mithril = require('../../../mithril');

exports.params = ['identifier', 'prefix', 'type', 'data'];

exports.execute = function (state, identifier, prefix, type, data, cb) {

	// params = { prefix: 'gacha:', type: 'gacha_free', data: { priority: 4, name: 'blah, hours: [[], []], recurring: [{}, {}]  } };   'ish
	mithril.shop.addShop(state, identifier, prefix, type, data, function (errors, shopIdent) {
		if (errors) {
			return cb(errors);
		}

		state.respond(shopIdent);
		cb();
	});
};
