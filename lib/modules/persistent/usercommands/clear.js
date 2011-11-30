var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, cb) {
	mithril.persistent.clear(state, cb);
};

