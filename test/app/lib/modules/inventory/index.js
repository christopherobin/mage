var mage = require('mage');
var Tome = mage.require('tomes').Tome;

exports.setup = function (state, cb) {
	for (var i = 0; i < 5; ++i) {
		state.archivist.add('inventory', { userId: 'user' + i }, Tome.conjure({
			money: 50 + i,
			items: {}
		}));
	}
	cb();
};
