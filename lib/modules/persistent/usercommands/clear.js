var mage = require('../../../mage');


exports.params = [];


exports.execute = function (state, cb) {
	mage.persistent.clear(state, cb);
};

