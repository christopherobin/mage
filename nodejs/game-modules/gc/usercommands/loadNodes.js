exports.execute = function(state, p, cb)
{
	var options = p.options || {};

	console.log((new Date).getTime() / 1000);

	var cfg = mithril.core.config.game.gc;

	var nodeTypes = (cfg && cfg.sync) ? (cfg.sync.nodeTypes || null) : null;

	var nodes = mithril.gc.getAllNodesArr();
	var len = nodes.length;

	var resultArr = [];
	var resultMap = [];

	for (var i=0; i < len; i++)
	{
		var node = nodes[i];

		// {"id":1405,"identifier":"34","type":"Area","data":{"descEn":"A forest basking in light.","descJa":"","nameEn":"The arrow forest","nameJa":"弓の森","world":"faeria"},"cin":{"unlock":{"0":[{"targetNode":1540,"onState":"done"}]}},"cout":{"parent":{"any":[1163]},"display":{"any":[1336]}}}

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

		console.log((new Date).getTime() / 1000);

		cb();
	});
	return;



	if (options.loadProgressForActor)
	{
		options.loadProgressForActor = state.actorId;
	}

	console.log((new Date).getTime() / 1000);

	mithril.gc.loadNodes(state, options, function(error, nodes) {
		if (!error)
			state.respond(nodes);

		console.log((new Date).getTime() / 1000);

		cb();
	});
};

