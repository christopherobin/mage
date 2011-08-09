var mithril = require('../../../mithril');


exports.execute = function(state, p, cb)
{
	var resultArr = [];
	var resultMap = [];

	mithril.gc.hooks.getSyncNodes(state, state.actorId, function(error, nodes) {
		if (error) return cb(error);

		// we will sync these nodes...

		var len = nodes.length;
		for (var i=0; i < len; i++)
		{
			var node = nodes[i];

			var newNode = { id: node.id, type: node.type };

			for (var connType in node.cin) { newNode.cin = node.cin; break; }
			for (var connType in node.cout) { newNode.cout = node.cout; break; }

			var data = node.data.getAll(state.language());

			for (var property in data) { newNode.data = data; break; }

			resultMap[node.id] = newNode;
			resultArr.push(newNode);
		}

		mithril.gc.loadNodeProgress(state, resultMap, state.actorId, false, function(error) {
			if (!error)
				state.respond(resultArr);

			cb();
		});
	});
};
