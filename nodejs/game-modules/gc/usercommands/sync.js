exports.execute = function(state, p, cb)
{
	var options = p.options || {};

	var cfg = mithril.core.config.game.gc;

	var nodeTypes = (cfg && cfg.sync) ? (cfg.sync.nodeTypes || null) : null;

	var nodes = mithril.gc.getAllNodesArr();
	var len = nodes.length;

	var resultArr = [];
	var resultMap = [];

	for (var i=0; i < len; i++)
	{
		var node = nodes[i];

		if (nodeTypes && nodeTypes.indexOf(node.type) == -1) continue;

		var newNode = { id: node.id, type: node.type };

		if (node.cin)
		{
			var empty = true;

			for (var connType in node.cin) { empty = false; break; }

			if (!empty)
			{
				newNode.cin = node.cin;
			}
		}

		if (node.cout)
		{
			var empty = true;
			for (var connType in node.cout) { empty = false; break; }

			if (!empty)
			{
				newNode.cout = node.cout;
			}
		}

		if (node.data)
		{
			var data = node.data.getAll(state.language());

			var empty = true;
			for (var property in data) { empty = false; break; }

			if (!empty)
				newNode.data = data;
		}

		resultMap[node.id] = newNode;
		resultArr.push(newNode);
	}

	mithril.gc.loadNodeProgress(state, resultMap, state.actorId, false, function(error) {
		if (!error)
			state.respond(resultArr);

		cb();
	});
};

