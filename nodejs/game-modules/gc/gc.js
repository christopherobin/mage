var errors = {
	GC_LOAD_FAILED:               { module: 'gc', code: 1000, log: { msg: 'Loading game content structure failed.', method: 'error' } },
	GC_LOAD_PROGRESS_FAILED:      { module: 'gc', code: 1001, log: { msg: 'Loading game content progress failed.', method: 'error' } },
	GC_LOAD_DATA_FAILED:          { module: 'gc', code: 1002, log: { msg: 'Loading game content data failed.', method: 'error' } },
	GC_LOAD_INCONNECTORS_FAILED:  { module: 'gc', code: 1003, log: { msg: 'Loading game content in-connectors.', method: 'error' } },
	GC_LOAD_OUTCONNECTORS_FAILED: { module: 'gc', code: 1004, log: { msg: 'Loading game content out-connectors.', method: 'error' } },
	SET_STATE_FAILED:             { module: 'gc', code: 2000, log: { msg: 'Setting game content state failed.', method: 'error' } },
	DEL_STATE_FAILED:             { module: 'gc', code: 2001, log: { msg: 'Deleting game content state failed.', method: 'error' } }
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
	if (nodeId in allNodes)
	{
		return allNodes[nodeId];
	}
	return null;
};


exports.findUnreferencedNodes = function(nodes, connectorType)
{
	var referenced = [];

	var len = nodes.length;
	for (var i=0; i < len; i++)
	{
		var node = nodes[i];
		if (node.cout && node.cout[connectorType])
		{
			var connector = node.cout[connectorType];

			for (var onState in connector)
			{
				for (var j=0; j < connector[onState].length; j++)
				{
					referenced.push(connector[onState][j]);
				}
			}
		}
	}

	return nodes.filter(function(node) { return (referenced.indexOf(node.id) == -1); });
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


exports.setNodeState = function(state, actorId, nodeId, newState, cb)
{
	var time = mithril.core.time;

	state.emit(actorId, 'gc.node.progress.edit', { nodeId: nodeId, state: newState, stateTime: time });

	var sql = 'INSERT INTO gc_progress VALUES(?, ?, ?, ?) ON DUPLICATE KEY UPDATE state = VALUES(state), stateTime = VALUES(stateTime)';
	var params = [actorId, nodeId, newState, time];

	state.datasources.db.exec(sql, params, errors.SET_STATE_FAILED, cb);
};


exports.delNodeState = function(state, actorId, nodeId, cb)
{
	state.emit(actorId, 'gc.node.progress.del', { nodeId: nodeId });

	var sql = 'DELETE FROM gc_progress WHERE actor = ? AND node = ?';
	var params = [actorId, nodeId];

	state.datasources.db.exec(sql, params, errors.DEL_STATE_FAILED, cb);
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
				var len = results.length;

				for (var i=0; i < len; i++)
				{
					var row = results[i];

					nodes[row.id] = row;
				}

				exports.loadNodeInformation(state, nodes, options, function(error) {
					if (error)
						cb(error);
					else
						cb(null, nodes);
				});
			}
		}
	});
};


exports.loadNodeInformation = function(state, nodes, options, cb)
{
	var queue = [];

	if (options.loadNodeData)
	{
		queue.push(function(nextCb) { exports.loadNodeData(state, nodes, nextCb); });
	}

	if (options.loadInConnectors)
	{
		queue.push(function(nextCb) { exports.loadNodeInConnectors(state, nodes, nextCb); });
	}

	if (options.loadOutConnectors)
	{
		queue.push(function(nextCb) { exports.loadNodeOutConnectors(state, nodes, nextCb); });
	}

	if (options.loadProgressForActor)
	{
		queue.push(function(nextCb) { exports.loadNodeProgress(state, nodes, options.loadProgressForActor, nextCb); });
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


exports.loadNodeProgress = function(state, nodes, actorId, cb)
{
	var query = 'SELECT node, state, stateTime FROM gc_progress WHERE actor = ?';
	var params = [actorId];

	state.datasources.db.getMany(query, params, errors.GC_LOAD_PROGRESS_FAILED, function(err, results) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			var len = results.length;
			for (var i=0; i < len; i++)
			{
				var row = results[i];

				if (row.node in nodes)
				{
					nodes[row.node].progress = { state: row.state, stateTime: row.stateTime };
				}
			}

			if (cb) cb(null);
		}
	});
};


exports.getNodesProgress = function(state, nodes, actorId, cb)
{	//nodes should be an array

	if (nodes.length == 0)
	{
		if (cb) cb(null, {});
		return;
	}

	var query = 'SELECT node, state FROM gc_progress WHERE actor = ? AND node IN (';
	var params = [actorId];

	for (var i=0; i < nodes.length; i++) //loop, add ?, push params;
	{
		params.push(nodes[i]);
		query += '? ,';
	}

	query = query.substr(0, query.length - 2);
	query += ')';

	state.datasources.db.getMany(query, params, errors.GC_LOAD_PROGRESS_FAILED, function(err, data) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			var result = {};
			for (var i=0;i<data.length;i++) //loop , dump in object
			{
				result[data[i].node] = data[i].state;
			}
			if (cb) cb(null, result);
		}
	});
};


exports.loadNodeData = function(state, nodes, cb)
{
	for (var id in nodes)
	{
		nodes[id].data = {};
	}

	var query = 'SELECT node, property, value FROM gc_node_data';
	var params = [];

	state.datasources.db.getMany(query, params, errors.GC_LOAD_DATA_FAILED, function(err, results) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			var len = results.length;
			for (var i=0; i < len; i++)
			{
				var row = results[i];

				if (row.node in nodes)
				{
					nodes[row.node].data[row.property] = row.value;
				}
			}

			if (cb) cb(null);
		}
	});
};


exports.loadNodeInConnectors = function(state, nodes, cb)
{
	for (var id in nodes)
	{
		nodes[id].cin = {};
	}

	var query = 'SELECT c.node, c.type, c.andGroup, ct.targetNode, ct.onState FROM gc_node_connector_in AS c JOIN gc_node_connector_in_target AS ct ON ct.connector = c.id';
	var params = [];

	state.datasources.db.getMany(query, params, errors.GC_LOAD_INCONNECTORS_FAILED, function(err, results) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			var len = results.length;
			for (var i=0; i < len; i++)
			{
				var row = results[i];

				if (row.node in nodes)
				{
					if (!(row.type     in nodes[row.node].cin          )) nodes[row.node].cin[row.type] = {};
					if (!(row.andGroup in nodes[row.node].cin[row.type])) nodes[row.node].cin[row.type][row.andGroup] = [];

					nodes[row.node].cin[row.type][row.andGroup].push({ targetNode: row.targetNode, onState: row.onState });
				}
			}

			if (cb) cb(null);
		}
	});
};


exports.loadNodeOutConnectors = function(state, nodes, cb)
{
	for (var id in nodes)
	{
		nodes[id].cout = {};
	}

	var query = 'SELECT c.node, c.type, c.onState, ct.targetNode FROM gc_node_connector_out AS c JOIN gc_node_connector_out_target AS ct ON ct.connector = c.id';
	var params = [];

	state.datasources.db.getMany(query, params, errors.GC_LOAD_OUTCONNECTORS_FAILED, function(err, results) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			var len = results.length;
			for (var i=0; i < len; i++)
			{
				var row = results[i];

				if (row.node in nodes)
				{
					if (!(row.type    in nodes[row.node].cout          )) nodes[row.node].cout[row.type] = {};
					if (!(row.onState in nodes[row.node].cout[row.type])) nodes[row.node].cout[row.type][row.onState] = [];

					nodes[row.node].cout[row.type][row.onState].push(row.targetNode);
				}
			}

			if (cb) cb(null);
		}
	});
};

