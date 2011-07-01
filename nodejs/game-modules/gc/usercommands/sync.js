exports.execute = function(state, p, cb)
{
	var options = p.options || {};

	var cfg = mithril.core.config.game.gc;

	var nodeTypes = (cfg && cfg.sync) ? (cfg.sync.nodeTypes || null) : null;
	if (!nodeTypes)
		nodeTypes = mithril.gc.getAllNodeTypes();

	var resultArr = [];
	var resultMap = [];

	var jlen = nodeTypes.length;
	for (var j=0; j < jlen; j++)
	{
		var nodes = mithril.gc.getAllNodesForType(nodeTypes[j]);
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
	}

	mithril.gc.loadNodeProgress(state, resultMap, state.actorId, false, function(error) {
		if (!error)
			state.respond(resultArr);

		cb();
	});
};

