var mithril = require('../../../mithril');

exports.params = ['nodes'];

exports.execute = function (state, nodes, cb) {
	if (!(nodes instanceof Array)) {
		nodes = [].concat(nodes);
	}

	mithril.gc.addNodes(state, nodes, function (error, newNodes) {
		if (error) {
			return cb(error);
		}

		state.respond(newNodes);
		cb();
	});
};

