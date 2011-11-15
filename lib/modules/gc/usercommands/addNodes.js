var mithril = require('../../../mithril');

exports.execute = function (state, p, cb) {
	if (!(p instanceof Array)) {
		p = [].concat(p);
	}

	mithril.gc.addNodes(state, p, function (error, newNodes) {
		if (error) {
			return cb(error);
		}

		state.respond(newNodes);
		cb();
	});
};

