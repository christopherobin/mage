var errors = {
	GC_LOAD_FAILED:               { module: 'gc', code: 1000, log: { msg: 'Loading game content structure failed.', method: 'error' } },
	GC_LOAD_PROGRESS_FAILED:      { module: 'gc', code: 1001, log: { msg: 'Loading game content progress failed.', method: 'error' } },
	GC_LOAD_DATA_FAILED:          { module: 'gc', code: 1002, log: { msg: 'Loading game content data failed.', method: 'error' } },
	GC_LOAD_INCONNECTORS_FAILED:  { module: 'gc', code: 1003, log: { msg: 'Loading game content in-connectors.', method: 'error' } },
	GC_LOAD_OUTCONNECTORS_FAILED: { module: 'gc', code: 1004, log: { msg: 'Loading game content out-connectors.', method: 'error' } }
};

exports.errors = errors;

exports.userCommands = {
	loadNodes: __dirname + '/usercommands/loadNodes.js'
};


var allNodes = null;


exports.setup = function(cb)
{
	var state = new mithril.core.state.State();

	exports.loadNodes(state, { loadNodeData: true, loadInConnectors: true, loadOutConnectors: true }, function(error, nodes) {
		if (error)
			cb(error);
		else
		{
			allNodes = nodes;
			cb(null);
		}

		state.cleanup();
	});
};


exports.getNode = function(nodeId)
{
	if (nodeId in gameStructure)
	{
		return gameStructure[nodeId];
	}
	return null;
};


exports.filterNodes = function(filter, nextMatch)
{
	// filter nodes to only the required ones

	var result = [];

	for (var nodeId in allNodes)
	{
		var node = allNodes[nodeId];
		if (filter(node))
			result.push(node);
	}

	var count = result.length;

	if (!nextMatch || count == 0) return result;

	// sort nodes

	function addToResult(out, filtered, i)
	{
		if (!filtered[i]) return -1;

		var node = filtered[i];
		var index;

		filtered[i] = null;

		var nextNodeId = nextMatch(node);
		if (nextNodeId)
		{
			var nextNode = allNodes[nextNodeId];

			index = out.indexOf(nextNode);
			if (index == -1)
			{
				index = addToResult(out, filtered, filtered.indexOf(nextNode));
			}

			if (index != -1)
			{
				out.splice(index, 0, node);
			}
		}
		else
		{
			out.push(node);
			index = out.length - 1;
		}

		return index;
	}

	var out = [];

	for (var i=0; i < count; i++)
		addToResult(out, result, i);

	return out;
};


exports.loadNodes = function(state, options, cb)
{
	// options: { loadProgressForActor: actorId, loadNodeData: true, loadInConnectors: true, loadOutConnectors: true }
	// loads as little as possible by default (if no options given)

	if (!options) options = {};

	var nodes = {};

	var query = 'SELECT id, identifier, type FROM gc_node';
	var params = [];

	state.datasources.db.getMany(query, params, errors.GC_LOAD_FAILED, function(err, results) {
		if (err)
			cb(err);
		else
		{
			if (results.length == 0)
			{
				cb(null, nodes);
			}
			else
			{
				for (var i=0; i < results.length; i++)
				{
					var node = results[i];

					nodes[node.id] = node;

					var nextCb = (cb && i == results.length - 1) ? function() { cb(null, nodes); } : null;

					exports.loadNodeInformation(state, node, options, nextCb);
				}
			}
		}
	});
};


exports.loadNodeInformation = function(state, node, options, cb)
{
	var queue = [];

	if (options.loadProgressForActor)
	{
		queue.push(function(nextCb) { exports.loadNodeProgress(state, node, options.loadProgressForActor, nextCb); });
	}

	if (options.loadNodeData)
	{
		queue.push(function(nextCb) { exports.loadNodeData(state, node, nextCb); });
	}

	if (options.loadInConnectors)
	{
		queue.push(function(nextCb) { exports.loadNodeInConnectors(state, node, nextCb); });
	}

	if (options.loadOutConnectors)
	{
		queue.push(function(nextCb) { exports.loadNodeOutConnectors(state, node, nextCb); });
	}

	var funcCount = queue.length;
	for (var i=0; i < funcCount; i++)
	{
		if (cb && i == funcCount-1)
			queue[i](cb);
		else
			queue[i]();
	}
};


exports.loadNodeProgress = function(state, node, actorId, cb)
{
	var query = 'SELECT state, stateTime FROM gc_progress WHERE node = ? AND actor = ?';
	var params = [node.id, actorId];

	state.datasources.db.getOne(query, params, false, errors.GC_LOAD_PROGRESS_FAILED, function(err, result) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			if (result)
			{
				node.progress = result;
			}

			if (cb) cb(null);
		}
	});
};


exports.loadNodeData = function(state, node, cb)
{
	var query = 'SELECT property, value FROM gc_node_data WHERE node = ?';
	var params = [node.id];

	state.datasources.db.getMany(query, params, errors.GC_LOAD_DATA_FAILED, function(err, results) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			node.data = {};

			for (var i=0; i < results.length; i++)
			{
				node.data[results[i].property] = results[i].value;
			}

			if (cb) cb(null);
		}
	});
};


exports.loadNodeInConnectors = function(state, node, cb)
{
	var query = 'SELECT c.type, c.andGroup, ct.targetNode, ct.onState FROM gc_node_connector_in AS c JOIN gc_node_connector_in_target AS ct ON ct.connector = c.id WHERE c.node = ?';
	var params = [node.id];

	state.datasources.db.getMany(query, params, errors.GC_LOAD_INCONNECTORS_FAILED, function(err, results) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			var count = results.length;

			if (count > 0)
			{
				node.inConnectors = {};

				for (var i=0; i < count; i++)
				{
					var result = results[i];

					if (!(result.type in node.inConnectors))
					{
						node.inConnectors[result.type] = {};
					}

					if (!(result.andGroup in node.inConnectors[result.type]))
					{
						node.inConnectors[result.type][result.andGroup] = [];
					}

					node.inConnectors[result.type][result.andGroup].push({ targetNode: result.targetNode, onState: result.onState });
				}
			}

			if (cb) cb(null);
		}
	});
};


exports.loadNodeOutConnectors = function(state, node, cb)
{
	var query = 'SELECT c.type, c.onState, ct.targetNode FROM gc_node_connector_out AS c JOIN gc_node_connector_out_target AS ct ON ct.connector = c.id WHERE c.node = ?';
	var params = [node.id];

	state.datasources.db.getMany(query, params, errors.GC_LOAD_OUTCONNECTORS_FAILED, function(err, results) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			var count = results.length;

			if (count > 0)
			{
				node.outConnectors = {};

				for (var i=0; i < count; i++)
				{
					var result = results[i];

					if (!(result.type in node.outConnectors))
					{
						node.outConnectors[result.type] = {};
					}

					if (!(result.onState in node.outConnectors[result.type]))
					{
						node.outConnectors[result.type][result.onState] = [];
					}

					node.outConnectors[result.type][result.onState].push(result.targetNode);
				}
			}

			if (cb) cb(null);
		}
	});
};

