var errors = {
	GC_LOAD_FAILED: { module: 'gc', code: 1000, log: { msg: 'Loading game content structure failed.', method: 'error' } },
};

exports.errors = errors;


exports.loadNodes = function(state, options, cb)
{
	// options: { loadProgressForActor: actorId, loadNodeData: true, load, loadInConnectors: true, loadOutConnectors: true }
	// loads as little as possible by default (if no options given)

	if (!options) options = {};

	var nodes = {};

	var query = 'SELECT id, identifier, type FROM node';
	var params = [];

	state.datasources.db.getMany(query, params, errors.GC_LOAD_FAILED, function(err, results) {
		if (err)
			cb(err);
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
		queue.push(function(nextCb) { exports.loadNodeOutConnectoors(state, node, nextCb); });
	}

	var funcCount = queue.length;
	for (var j=0; j < funcCount; j++)
	{
		if (cb && j == funcCount-1)
			queue[i](cb);
		else
			queue[i]();
	}
};


exports.loadNodeProgress = function(state, node, actorId, cb)
{
	var query = 'SELECT state, stateTime FROM gc_node_progress WHERE node = ? AND actor = ?';
	var params = [node.id, actorId];

	state.datasources.db.getOne(query, params, false, errors.GC_LOAD_FAILED, function(err, result) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			node.progress = result;
			if (cb) cb(null);
		}
	});
};


exports.loadNodeData = function(state, node, cb)
{
	var query = 'SELECT property, value FROM gc_node_data WHERE node = ?';
	var params = [node.id];

	state.datasources.db.getMany(query, params, errors.GC_LOAD_FAILED, function(err, results) {
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
	var query = 'SELECT c.type, cs.andGroup, cs.targetNode, cs.onState FROM gc_node_connector_in AS c JOIN gc_node_connector_in_stategroup AS cs ON cs.connector = c.id WHERE c.node = ?';
	var params = [node.id];

	state.datasources.db.getMany(query, params, errors.GC_LOAD_FAILED, function(err, results) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			node.inConnectors = {};

			for (var i=0; i < results.length; i++)
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

			if (cb) cb(null);
		}
	});
};


exports.loadNodeOutConnectors = function(state, node, cb)
{
	var query = 'SELECT c.type, c.onState FROM gc_node_connector_out AS c JOIN gc_node_connector_out_on AS co ON co.connector = c.id WHERE c.node = ?';
	var params = [node.id];

	state.datasources.db.getMany(query, params, errors.GC_LOAD_FAILED, function(err, results) {
		if (err)
		{
			if (cb) cb(err);
		}
		else
		{
			node.outConnectors = {};

			for (var i=0; i < results.length; i++)
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

			if (cb) cb(null);
		}
	});
};

