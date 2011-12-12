var mithril = require('../../../mithril');

exports.execute = function (state, p, cb) {
	if (!(p instanceof Array)) {
		p = [].concat(p);
	}

	mithril.gc.delOutConnectors(state, p, cb);
};

