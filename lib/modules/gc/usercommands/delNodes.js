var mithril = require('../../../mithril');

exports.execute = function (state, p, cb) {
	if (!(p instanceof Array)) {
		p = [].concat(p);
	}

	mithril.gc.delNodes(state, p, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};

