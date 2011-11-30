var mithril = require('../../../mithril');


exports.params = ['properties'];


exports.execute = function (state, properties, cb) {
	mithril.persistent.del(state, properties, cb);
};

