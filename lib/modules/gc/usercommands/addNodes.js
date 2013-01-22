var mage = require('../../../mage');

exports.params = ['nodes'];

exports.execute = function (state, nodes, cb) {
	if (!Array.isArray(nodes)) {
		nodes = [nodes];
	}

	mage.gc.addNodes(state, nodes, function (error, newNodes) {
		if (error) {
			return cb(error);
		}

		state.respond(newNodes);
		cb();
	});
};

