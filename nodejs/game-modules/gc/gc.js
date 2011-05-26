exports.userCommands = {
	loadNodes: __dirname + '/usercommands/loadNodes.js'
};


var allNodesArr = null;
var allNodesMap = null;


exports.setup = function(cb)
{
	var state = new mithril.core.state.State();

	exports.loadNodes(state, { loadNodeData: true, loadInConnectors: true, loadOutConnectors: true }, function(error, nodesMap, nodesArr) {
		if (error)
			cb(error);
		else
		{
			allNodesMap = nodesMap;
			allNodesArr = nodesArr;

			cb();
		}

		state.close();
	});
};


exports.getNode = function(nodeId)
{
	if (nodeId in allNodesMap)
	{
		return allNodesMap[nodeId];
	}
	return null;
};


exports.findUnreferencedNodes = function(nodesArr, connectorType)
{
	var referenced = [];

	var len = nodesArr.length;
	for (var i=0; i < len; i++)
	{
		var node = nodesArr[i];

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

	return nodesArr.filter(function(node) { return (referenced.indexOf(node.id) == -1); });
};


exports.filterNodes = function(filter, nextMatch, nodesArr)
{
	// filter nodes to only the required ones

	if (!nodesArr) nodesArr = allNodesArr;

	if (filter)
	{
		nodesArr = nodesArr.filter(filter);
	}

	var count = nodesArr.length;

	if (!nextMatch || count == 0) return nodesArr;

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
			var nextNode = allNodesMap[nextNodeId];

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
		addToResult(out, nodesArr, i);

	return out;
};


exports.setNodeState = function(state, actorId, nodeId, newState, cb)
{
	var time = mithril.core.time;

	state.emit(actorId, 'gc.node.progress.edit', { nodeId: nodeId, state: newState, stateTime: time });

	var sql = 'INSERT INTO gc_progress VALUES(?, ?, ?, ?) ON DUPLICATE KEY UPDATE state = VALUES(state), stateTime = VALUES(stateTime)';
	var params = [actorId, nodeId, newState, time];

	state.datasources.db.exec(sql, params, null, cb);
};


exports.delNodeState = function(state, actorId, nodeId, cb)
{
	state.emit(actorId, 'gc.node.progress.del', { nodeId: nodeId });

	var sql = 'DELETE FROM gc_progress WHERE actor = ? AND node = ?';
	var params = [actorId, nodeId];

	state.datasources.db.exec(sql, params, null, cb);
};


exports.loadNodes = function(state, options, cb)
{
	// options: { loadProgressForActor: actorId, loadNodeData: true, loadInConnectors: true, loadOutConnectors: true }
	// loads as little as possible by default (if no options given)

	if (!options) options = {};

	var nodesMap = {};

	var query = 'SELECT id, identifier, type FROM gc_node';
	var params = [];

	state.datasources.db.getMany(query, params, null, function(err, nodesArr) {
		if (err) return cb(err);

		if (nodesArr.length == 0)
		{
			cb(null, nodesMap, nodesArr);
		}
		else
		{
			var len = nodesArr.length;

			for (var i=0; i < len; i++)
			{
				var node = nodesArr[i];

				nodesMap[node.id] = node;
			}

			exports.loadNodeInformation(state, nodesMap, options, function(error) {
				if (error)
					cb(error);
				else
					cb(null, nodesMap, nodesArr);
			});
		}
	});
};


exports.loadNodeInformation = function(state, nodesMap, options, cb)
{
	var tasks = [];

	if (options.loadNodeData)
	{
		tasks.push(function(callback) { exports.loadNodeData(state, nodesMap, callback); });
	}

	if (options.loadInConnectors)
	{
		tasks.push(function(callback) { exports.loadNodeInConnectors(state, nodesMap, callback); });
	}

	if (options.loadOutConnectors)
	{
		tasks.push(function(callback) { exports.loadNodeOutConnectors(state, nodesMap, callback); });
	}

	if (options.loadProgressForActor)
	{
		tasks.push(function(callback) { exports.loadNodeProgress(state, nodesMap, options.loadProgressForActor, callback); });
	}

	if (tasks.length > 0)
	{
		async.series(tasks, function(error) { cb(); });
	}
	else
		cb();
};


exports.loadNodeProgress = function(state, nodesMap, actorId, cb)
{
	var query = 'SELECT node, state, stateTime FROM gc_progress WHERE actor = ?';
	var params = [actorId];

	state.datasources.db.getMany(query, params, null, function(err, results) {
		if (err) return cb(err);

		var len = results.length;
		for (var i=0; i < len; i++)
		{
			var row = results[i];

			if (row.node in nodesMap)
			{
				nodesMap[row.node].progress = { state: row.state, stateTime: row.stateTime };
			}
		}

		cb();
	});
};


exports.getNodesProgress = function(state, nodeIds, actorId, cb)
{
	if (nodeIds.length == 0)
	{
		return cb(null, {});
	}

	var query = 'SELECT node, state FROM gc_progress WHERE actor = ? AND node IN (';
	var params = [actorId];

	for (var i=0; i < nodeIds.length; i++)
	{
		params.push(nodeIds[i]);
		query += '? ,';
	}

	query = query.substr(0, query.length - 2);
	query += ')';

	state.datasources.db.getMany(query, params, null, function(err, data) {
		if (err) return cb(err);

		var result = {};

		for (var i=0; i < data.length; i++)
		{
			result[data[i].node] = data[i].state;
		}

		cb(null, result);
	});
};


exports.loadNodeData = function(state, nodesMap, cb)
{
	for (var id in nodesMap)
	{
		nodesMap[id].data = {};
	}

	var query = 'SELECT node, property, value FROM gc_node_data';
	var params = [];

	state.datasources.db.getMany(query, params, null, function(err, results) {
		if (err) return cb(err);

		var len = results.length;
		for (var i=0; i < len; i++)
		{
			var row = results[i];

			if (row.node in nodesMap)
			{
				nodesMap[row.node].data[row.property] = row.value;
			}
		}

		cb();
	});
};


exports.loadNodeInConnectors = function(state, nodesMap, cb)
{
	for (var id in nodesMap)
	{
		nodesMap[id].cin = {};
	}

	var query = 'SELECT c.node, c.type, c.andGroup, ct.targetNode, ct.onState FROM gc_node_connector_in AS c JOIN gc_node_connector_in_target AS ct ON ct.connector = c.id';
	var params = [];

	state.datasources.db.getMany(query, params, null, function(err, results) {
		if (err) return cb(err);

		var len = results.length;
		for (var i=0; i < len; i++)
		{
			var row = results[i];

			if (row.node in nodesMap)
			{
				var node = nodesMap[row.node];

				if (!(row.type     in node.cin          )) node.cin[row.type] = {};
				if (!(row.andGroup in node.cin[row.type])) node.cin[row.type][row.andGroup] = [];

				node.cin[row.type][row.andGroup].push({ targetNode: row.targetNode, onState: row.onState });
			}
		}

		cb();
	});
};


exports.loadNodeOutConnectors = function(state, nodesMap, cb)
{
	for (var id in nodesMap)
	{
		nodesMap[id].cout = {};
	}

	var query = 'SELECT c.node, c.type, c.onState, ct.targetNode FROM gc_node_connector_out AS c JOIN gc_node_connector_out_target AS ct ON ct.connector = c.id';
	var params = [];

	state.datasources.db.getMany(query, params, null, function(err, results) {
		if (err) return cb(err);

		var len = results.length;
		for (var i=0; i < len; i++)
		{
			var row = results[i];

			if (row.node in nodesMap)
			{
				var node = nodesMap[row.node];

				if (!(row.type    in node.cout          )) node.cout[row.type] = {};
				if (!(row.onState in node.cout[row.type])) node.cout[row.type][row.onState] = [];

				node.cout[row.type][row.onState].push(row.targetNode);
			}
		}

		cb();
	});
};

