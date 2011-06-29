exports.userCommands = {
	sync: __dirname + '/usercommands/sync.js'
};

var allNodesMap = null;
var allNodesArr = null;
var allNodesTypedArr = null;


exports.setup = function(state, cb)
{
	exports.loadNodes(state, { loadNodeData: true, loadInConnectors: true, loadOutConnectors: true }, function(error, nodesMap, nodesArr, nodesTypedArr) {
		if (error) return cb(error);

		allNodesMap = nodesMap;
		allNodesArr = nodesArr;
		allNodesTypedArr = nodesTypedArr;

		cb();
	});
};


exports.getNode = function(nodeId)
{
	return allNodesMap[nodeId] || null;
};


exports.getAllNodesMap = function() { return allNodesMap; };
exports.getAllNodesArr = function() { return allNodesArr; };


// event handling:

var eventHandlers = {};

exports.on = function(eventName, fn)
{
	var handler = { fn: fn, once: false };

	if (!eventHandlers[eventName])
		eventHandlers[eventName] = [handler];
	else
		eventHandlers[eventName].push(handler);
};


function emit(eventName, params, cb)
{
	// real params: [givenParam1, givenParam2, ..., callback]

	var handlers = eventHandlers[eventName];

	if (!handlers || handlers.length == 0) return cb();

	async.forEachSeries(
		handlers,
		function(handler, callback) {
			var p = params.concat(callback);
			handler.fn.apply(null, p);
		},
		cb
	);
}


// module logic:

exports.triggerNode = function(state, nodeId, data, cb)
{
	var node = exports.getNode(nodeId);
	if (!node)
	{
		return state.error(null, 'Cannot trigger node that does not exist: ' + nodeId, cb);
	}

	emit('trigger', [state, node, data], cb);
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
				var jlen = connector[onState].length;
				for (var j=0; j < jlen; j++)
				{
					referenced.push(connector[onState][j]);
				}
			}
		}
	}

	return nodesArr.filter(function(node) { return (referenced.indexOf(node.id) == -1); });
};


exports.findNodesByType = function(nodesArr, nodeType)
{
	if (!nodesArr || nodesArr === allNodesArr)
	{
		return allNodesTypedArr[nodeType] || [];
	}

	var result = [];

	var len = nodesArr.length;
	for (var i=0; i < len; i++)
	{
		var node = nodesArr[i];
		if (node.type === nodeType) result.push(node);
	}

	return result;
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


exports.getInRequirements = function(state, actorId, nodeId, type, cb)
{
	var node = allNodesMap[nodeId];

	if (!node) return state.error(null, 'Node not found: ' + nodeId, cb);

	if (node.cin && node.cin[type])
	{
		// load all states for nodes that are involved

		var connectors = node.cin[type];
		var nodeIds = [];

		for (groupId in connectors)
		{
			var group = connectors[groupId];
			var len = group.length;

			for (var i=0; i < len; i++)
			{
				nodeIds.push(group[i].targetNode);
			}
		}

		exports.getNodesProgress(state, nodeIds, actorId, function(error, nodeStates) {
			if (error) return cb(error);

			var required = [];

			for (groupId in connectors)
			{
				var group = connectors[groupId];
				var len = group.length;

				var groupRequired = [];

				for (var i=0; i < len; i++)
				{
					var cond = group[i];

					if (nodeStates[cond.targetNode] != cond.onState)
					{
						groupRequired.push(allNodesMap[cond.targetNode]);
					}
				}

				if (groupRequired.length == 0)
				{
					return cb(null, true);
				}

				required.push(groupRequired);
			}

			cb(null, required);
		});
	}
	else
		cb(null, true);
};


exports.setNodeProgress = function(state, actorId, nodeId, newState, save, cb)
{
	var time = mithril.core.time;

	state.emit(actorId, 'gc.node.progress.edit', { nodeId: nodeId, state: newState, stateTime: time });

	emit('progressChanged', [state, exports.getNode(nodeId), newState], function(error) {
		if (error) return cb(error);

		if (save)
		{
			// we do the actual write last

			var sql = 'INSERT INTO gc_progress VALUES(?, ?, ?, ?) ON DUPLICATE KEY UPDATE state = VALUES(state), stateTime = VALUES(stateTime)';
			var params = [actorId, nodeId, newState, time];

			state.datasources.db.exec(sql, params, null, function(error) { cb(error); });
		}
		else
			cb();
	});
};


exports.incNodeProgress = function(state, actorId, nodeId, increment, save, cb)
{
	// parses the node progress as integer, and increments it by "increment"

	exports.getNodeProgress(state, actorId, nodeId, function(error, progress) {
		if (error) return cb(error);

		var newProgress = ~~progress + increment;

		exports.setNodeProgress(state, actorId, nodeId, newProgress, save, cb);
	});
};


exports.delNodeProgress = function(state, actorId, nodeId, cb)
{
	state.emit(actorId, 'gc.node.progress.del', { nodeId: nodeId });

	var sql = 'DELETE FROM gc_progress WHERE actor = ? AND node = ?';
	var params = [actorId, nodeId];

	state.datasources.db.exec(sql, params, null, function(error) { cb(error); });
};


exports.loadNodes = function(state, options, cb)
{
	// options: { loadProgressForActor: actorId, loadNodeData: true, loadInConnectors: true, loadOutConnectors: true }
	// loads as little as possible by default (if no options given)

	if (!options) options = {};

	var nodesMap = {};
	var nodesTypedArr = {};

	var query = 'SELECT id, identifier, type FROM gc_node';
	var params = [];

	state.datasources.db.getMany(query, params, null, function(err, nodesArr) {
		if (err) return cb(err);

		if (nodesArr.length == 0)
		{
			return cb(null, nodesMap, nodesArr, nodesTypedArr);
		}

		var len = nodesArr.length;

		for (var i=0; i < len; i++)
		{
			var node = nodesArr[i];

			nodesMap[node.id] = node;

			if (node.type in nodesTypedArr)
			{
				nodesTypedArr[node.type].push(node);
			}
			else
				nodesTypedArr[node.type] = [node];
		}

		exports.loadNodeInformation(state, nodesMap, options, function(error) {
			if (error) return cb(error);

			cb(null, nodesMap, nodesArr, nodesTypedArr);
		});
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
		tasks.push(function(callback) { exports.loadNodeProgress(state, nodesMap, options.loadProgressForActor, true, callback); });
	}

	if (tasks.length > 0)
	{
		async.series(tasks, function(error) { cb(); });
	}
	else
		cb();
};


exports.loadNodeProgress = function(state, nodesMap, actorId, includeTime, cb)
{
	// TODO: we are augmenting nodes???? scary for multi-user!!!!

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
				nodesMap[row.node].progress = includeTime ? { state: row.state, stateTime: row.stateTime } : row.state;
			}
		}

		cb();
	});
};


exports.getNodeProgress = function(state, actorId, nodeId, cb)
{
	var sql = 'SELECT state FROM gc_progress WHERE actor = ? AND node = ?';
	var params = [actorId, nodeId];

	state.datasources.db.getOne(sql, params, false, null, function(error, row) {
		if (error) return cb(error);

		cb(null, row ? (row.state || null) : null);
	});
};


exports.getNodesProgress = function(state, nodeIds, actorId, cb)
{
	if (nodeIds.length == 0)
	{
		return cb(null, {});
	}

	var result = {};

	var query = 'SELECT node, state FROM gc_progress WHERE actor = ? AND node IN (';
	var params = [actorId];
	var values = [];

	var len = nodeIds.length;
	for (var i=0; i < len; i++)
	{
		result[nodeIds[i]] = null;	// those not returned will be null

		params.push(nodeIds[i]);
		values.push('?');
	}

	query += values.join(', ') + ')';

	state.datasources.db.getMany(query, params, null, function(err, data) {
		if (err) return cb(err);

		var len = data.length;
		for (var i=0; i < len; i++)
		{
			result[data[i].node] = data[i].state;
		}

		cb(null, result);
	});
};


exports.loadNodeData = function(state, nodesMap, cb)
{
	var query = 'SELECT node, property, language, type, value FROM gc_node_data';
	var params = [];

	state.datasources.db.getMany(query, params, null, function(err, results) {
		if (err) return cb(err);

		for (var id in nodesMap)
		{
			nodesMap[id].data = new mithril.core.PropertyMap;
		}

		var len = results.length;
		for (var i=0; i < len; i++)
		{
			var row = results[i];

			if (row.node in nodesMap)
			{
				nodesMap[row.node].data.importOne(row.property, row.type, row.value, row.language);
			}
		}

		cb();
	});
};


exports.loadNodeInConnectors = function(state, nodesMap, cb)
{
	var query = 'SELECT c.node, c.type, c.andGroup, ct.targetNode, ct.onState FROM gc_node_connector_in AS c JOIN gc_node_connector_in_target AS ct ON ct.connector = c.id';
	var params = [];

	state.datasources.db.getMany(query, params, null, function(err, results) {
		if (err) return cb(err);

		for (var id in nodesMap)
		{
			nodesMap[id].cin = {};
		}

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
	var query = 'SELECT c.node, c.type, c.onState, ct.targetNode FROM gc_node_connector_out AS c JOIN gc_node_connector_out_target AS ct ON ct.connector = c.id';
	var params = [];

	state.datasources.db.getMany(query, params, null, function(err, results) {
		if (err) return cb(err);

		for (var id in nodesMap)
		{
			nodesMap[id].cout = {};
		}

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

