var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, p, cb) {
	mithril.persistent.clear(state, cb);
};

