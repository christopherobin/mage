var mithril = require('../../../mithril');

exports.params = ['nodes'];

exports.execute = function (state, nodes, cb) {
	if (!Array.isArray(nodes)) {
		nodes = [nodes];
	}

	mithril.gc.addNodes(state, nodes, function (error, newNodes) {
		if (error) {
			return cb(error);
		}

		state.respond(newNodes);
		cb();
	});
};

