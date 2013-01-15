var mage = require('../../../mage');


exports.params = ['properties'];


exports.execute = function (state, properties, cb) {
	mage.persistent.del(state, properties, cb);
};

