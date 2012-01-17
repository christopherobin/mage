var mithril = require('../../../mithril');

exports.params = ['nodes'];

exports.execute = function (state, nodes, cb) {
	if (!(nodes instanceof Array)) {
		nodes = [].concat(nodes);
	}

	mithril.gc.delNodes(state, nodes, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};

