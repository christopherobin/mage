var mithril = require('../../../mithril');

exports.params = [];

exports.execute = function (state, cb) {
	var nodes   = mithril.gc.getAllNodesArr();
	var len = nodes.length;
	var results = new Array(len);

	for (var i = 0; i < len; i++) {
		var node = nodes[i];

		results[i] = {
			id: node.id,
			type: node.type,
			cin: node.cin,
			cout: node.cout,
			data: node.data ? node.data.getAllFlat(true) : {}
		};
	}

	state.respond(results);
	cb();
};

