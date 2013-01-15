var mage = require('../../../mage');

exports.params = ['from', 'to', 'playerId'];

exports.execute = function (state, from, to, playerId, cb) {

	mage.shop.getPurchaseHistory(state, from, to, playerId, function (err, rows) {
		if (err) {
			return cb(err);
		}
		state.respond(rows);
		cb();
	});

};