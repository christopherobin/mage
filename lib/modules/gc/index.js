var mithril = require('../../mithril');
var uuid    = require('node-uuid');
var async   = require('async');
var util    = require('util');


var allNodesMap = null;
var allNodesIdentifiedMap = null;
var allNodesArr = null;
var allNodesTypedArr = null;


exports.hooks = {
	getSyncNodes: function (state, actorId, cb) {
		cb(null, allNodesArr);
	}
};


exports.getManageCommands = function () {
	return [
		'gmsync',
		'addNodes',
		'editNodes',
		'delNodes',
//		'addOutConnectors',
//		'editOutConnectors',
//		'delOutConnectors'
	];
};


exports.setup = function (state, cb) {
	exports.loadNodes(state, { loadNodeData: true, loadInConnectors: true, loadOutConnectors: true }, function (error, nodesMap, nodesIdentifiedMap, nodesArr, nodesTypedArr) {
		if (error) {
			return cb(error);
		}

		allNodesMap = nodesMap;
		allNodesIdentifiedMap = nodesIdentifiedMap;
		allNodesArr = nodesArr;
		allNodesTypedArr = nodesTypedArr;

		cb();
	});
};


exports.getNode = function (nodeId) {
	return allNodesMap[nodeId] || null;
};


exports.getNodeByIdentifier = function (identifier) {
	return allNodesIdentifiedMap[identifier] || null;
};


exports.getAllNodesMap = function () {
	return allNodesMap;
};

exports.getAllNodesArr = function () {
	return allNodesArr;
};


exports.getAllNodesForType = function (type) {
	return allNodesTypedArr[type] || [];
};


exports.getAllNodesForTypes = function (types) {
	var result = [];

	for (var i = 0, len = types.length; i < len; i++) {
		var nodes = allNodesTypedArr[types[i]];
		if (nodes) {
			result = result.concat(nodes);
		}
	}

	return result;
};


// module logic:

exports.triggerNode = function (state, nodeId, data, cb) {
	var node = allNodesMap[nodeId];
	if (!node) {
		return state.error(null, 'Cannot trigger node that does not exist: ' + nodeId, cb);
	}

	exports.emit('trigger', [state, node, data], cb);
};


exports.getAllNodeTypes = function () {
	return Object.keys(allNodesTypedArr);
};


exports.findUnreferencedNodes = function (nodesArr, connectorType) {
	var referenced = [];

	var len = nodesArr.length;
	for (var i = 0; i < len; i++) {
		var connector = nodesArr[i].cout[connectorType];
		if (connector) {
			for (var onState in connector) {
				var jlen = connector[onState].length;
				for (var j = 0; j < jlen; j++) {
					referenced.push(connector[onState][j]);
				}
			}
		}
	}

	var result = [];

	for (i = 0; i < len; i++) {
		if (referenced.indexOf(nodesArr[i].id) === -1) {
			result.push(nodesArr[i]);
		}
	}

	return result;
};


exports.findNodesByType = function (nodesArr, nodeType) {
	if (!nodesArr || nodesArr === allNodesArr) {
		return allNodesTypedArr[nodeType] || [];
	}

	var result = [];

	for (var i = 0, len = nodesArr.length; i < len; i++) {
		var node = nodesArr[i];

		if (node.type === nodeType) {
			result.push(node);
		}
	}

	return result;
};


exports.filterNodes = function (filter, nextMatch, nodesArr) {
	// filter nodes to only the required ones

	if (!nodesArr) {
		nodesArr = allNodesArr;
	}

	// apply the filter function

	if (filter) {
		nodesArr = nodesArr.filter(filter);
	}

	// if we don't care about sorting, or if there are no nodes to sort, return an empty array

	var count = nodesArr.length;

	if (!nextMatch || count === 0) {
		return nodesArr;
	}

	// sort nodes

	function addToResult(out, filtered, i) {
		if (!filtered[i]) {
			return -1;
		}

		var node = filtered[i];
		var index;

		filtered[i] = null;

		var nextNodeId = nextMatch(node);
		if (nextNodeId) {
			var nextNode = allNodesMap[nextNodeId];

			index = out.indexOf(nextNode);
			if (index === -1) {
				index = addToResult(out, filtered, filtered.indexOf(nextNode));
			}

			if (index !== -1) {
				out.splice(index, 0, node);
			}
		} else {
			out.push(node);
			index = out.length - 1;
		}

		return index;
	}

	var out = [];

	for (var i = 0; i < count; i++) {
		addToResult(out, nodesArr, i);
	}

	return out;
};


exports.getOutNodeId = function (node, connectorType, state) {
	var conns = node.cout[connectorType];
	if (conns) {
		var links = conns[state] || conns.any;
		if (links) {
			return links[0];
		}
	}

	return null;
};


exports.getOutNode = function (node, connectorType, state) {
	var id = exports.getOutNodeId(node, connectorType, state);
	return id ? allNodesMap[id] : null;
};


exports.getOutNodeIds = function (node, connectorType, state) {
	var conns = node.cout[connectorType];

	return conns ? (conns[state] || conns.any || []) : [];
};


exports.getInRequirements = function (state, actorId, nodeId, type, cb) {
	var node = allNodesMap[nodeId];

	if (!node) {
		return state.error(null, 'Node not found: ' + nodeId, cb);
	}

	if (node.cin && node.cin[type]) {
		// load all states for nodes that are involved

		var connectors = node.cin[type];
		var nodeIds = [];

		for (var groupId in connectors) {
			var group = connectors[groupId];
			var len = group.length;

			for (var i = 0; i < len; i++) {
				nodeIds.push(group[i].targetNode);
			}
		}

		exports.getNodesProgress(state, nodeIds, actorId, function (error, nodeStates) {
			if (error) {
				return cb(error);
			}

			var required = [];

			for (var groupId in connectors) {
				var group = connectors[groupId];
				var len = group.length;

				var groupRequired = [];

				for (var i = 0; i < len; i++) {
					var cond = group[i];

					if (nodeStates[cond.targetNode] !== cond.onState) {
						groupRequired.push(allNodesMap[cond.targetNode]);
					}
				}

				if (groupRequired.length === 0) {
					return cb(null, true);
				}

				required.push(groupRequired);
			}

			cb(null, required);
		});
	} else {
		cb(null, true);
	}
};


exports.setNodeProgress = function (state, actorId, nodeId, newState, save, cb) {
	var time = mithril.core.time;

	// cast the new progress value to a string

	newState = '' + newState;

	exports.emit('progressChanged', [state, exports.getNode(nodeId), newState], function (error) {
		if (error) {
			return cb(error);
		}

		if (save) {
			// notify the client

			state.emit(actorId, 'gc.node.progress.edit', { nodeId: nodeId, state: newState });

			// we do the actual write last

			var sql = 'INSERT INTO gc_progress VALUES(?, ?, ?, ?) ON DUPLICATE KEY UPDATE state = VALUES(state), stateTime = VALUES(stateTime)';
			var params = [actorId, nodeId, newState, time];

			state.datasources.db.exec(sql, params, null, function (error) {
				cb(error);
			});
		} else {
			cb();
		}
	});
};


exports.incNodeProgress = function (state, actorId, nodeId, increment, save, cb) {
	// parses the node progress as integer, and increments it by "increment"

	// TODO: in the callback, return the old value and the new value

	exports.getNodeProgress(state, actorId, nodeId, function (error, progress) {
		if (error) {
			return cb(error);
		}

		var newProgress = ~~progress + increment;

		exports.setNodeProgress(state, actorId, nodeId, newProgress, save, cb);
	});
};


exports.replaceNodeProgress = function (state, actorId, nodeId, fnReplace, save, cb) {
	// uses a given function (fnReplace) to transform the old progress value into a new one and writes it back.
	// returns the old and the new progress values in the callback

	exports.getNodeProgress(state, actorId, nodeId, function (error, progress) {
		if (error) {
			return cb(error);
		}

		// transform into a new value and cast to string

		var newProgress = '' + fnReplace(progress);

		// If the value did not change, we do not have to write to DB. A progressChanged event will still fire however.

		if (newProgress === progress) {
			save = false;
		}

		exports.setNodeProgress(state, actorId, nodeId, newProgress, save, function (error) {
			if (error) {
				return cb(error);
			}

			return cb(null, progress, newProgress);
		});
	});
};


exports.delNodeProgress = function (state, actorId, nodeId, cb) {
	state.emit(actorId, 'gc.node.progress.del', { nodeId: nodeId });

	var sql = 'DELETE FROM gc_progress WHERE actor = ? AND node = ?';
	var params = [actorId, nodeId];

	state.datasources.db.exec(sql, params, null, function (error) {
		cb(error);
	});
};


exports.getActorProperties = function (state, actorId, nodeId, properties, cb) {
	// If a property is defined with the language AND without a language, one will overwrite the other without any guarantee about which is returned.
	// This is by design.

	var db = state.datasources.db;

	var query = 'SELECT property, type, value FROM gc_node_actor_data WHERE nodeId = ? AND actorId = ? AND language IN (?, ?)';
	var params = [nodeId, actorId, state.language(), ''];

	if (properties && properties.length > 0) {
		query += ' AND property IN (' + db.getPlaceHolders(properties.length) + ')';
		params = params.concat(properties);
	}

	db.getMapped(query, params, { key: 'property', type: 'type', value: 'value' }, null, function (error, data) {
		if (error) {
			return cb(error);
		}

		cb(null, data);
	});
};


exports.setActorProperties = function (state, actorId, nodeId, propertyMap, cb) {
	nodeId = ~~nodeId;

	var properties = propertyMap.getAllFlat(true, true);

	var sql = 'INSERT INTO gc_node_actor_data VALUES';

	var values = [];
	var params = [];

	for (var i = 0, len = properties.length; i < len; i++) {
		var prop = properties[i];

		values.push('(?, ?, ?, ?, ?, ?)');
		params.push(nodeId, actorId, prop.property, prop.language || '', prop.type, prop.value);
	}

	sql += values.join(', ') + ' ON DUPLICATE KEY UPDATE value = VALUES(value)';

	state.datasources.db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		state.emit(actorId, 'gc.node.actorData.edit', { nodeId: nodeId, properties: propertyMap.getAll(state.language()) });

		cb();
	});
};


exports.delActorProperties = function (state, actorId, nodeId, properties, cb) {
	nodeId = ~~nodeId;

	var db = state.datasources.db;

	var sql = 'DELETE FROM gc_node_actor_data WHERE nodeId = ? AND actorId = ? AND property IN (' + db.getPlaceHolders(properties.length) + ')';
	var params = [nodeId, actorId].concat(properties);

	db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		state.emit(actorId, 'gc.node.actorData.del', { nodeId: nodeId, properties: properties });

		cb();
	});
};


exports.loadNodes = function (state, options, cb) {
	// options: { loadNodeData: true, loadInConnectors: true, loadOutConnectors: true }
	// loads as little as possible by default (if no options given)

	options = options || {};

	var nodesMap = {};
	var nodesIdentifiedMap = {};
	var nodesTypedArr = {};

	var query = 'SELECT id, identifier, type FROM gc_node';
	var params = [];

	state.datasources.db.getMany(query, params, null, function (err, nodesArr) {
		if (err) {
			return cb(err);
		}

		if (nodesArr.length === 0) {
			return cb(null, nodesMap, nodesArr, nodesTypedArr);
		}

		var len = nodesArr.length;

		for (var i = 0; i < len; i++) {
			var node = nodesArr[i];

			nodesMap[node.id] = node;
			nodesIdentifiedMap[node.identifier] = node;

			if (node.type in nodesTypedArr) {
				nodesTypedArr[node.type].push(node);
			} else {
				nodesTypedArr[node.type] = [node];
			}
		}

		exports.loadNodeInformation(state, nodesMap, options, function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, nodesMap, nodesIdentifiedMap, nodesArr, nodesTypedArr);
		});
	});
};


exports.loadNodeInformation = function (state, nodesMap, options, cb) {
	var tasks = [];

	if (options.loadNodeData) {
		tasks.push(function (callback) {
			exports.loadNodeData(state, nodesMap, callback);
		});
	}

	if (options.loadInConnectors) {
		tasks.push(function (callback) {
			exports.loadNodeInConnectors(state, nodesMap, callback);
		});
	}

	if (options.loadOutConnectors) {
		tasks.push(function (callback) {
			exports.loadNodeOutConnectors(state, nodesMap, callback);
		});
	}

	if (tasks.length > 0) {
		async.series(tasks, cb);
	} else {
		cb();
	}
};


exports.loadNodeProgressAndData = function (state, nodesMap, actorId, includeTime, cb) {
	async.series([
		function (callback) {
			// load node progress

			var query = 'SELECT node, state' + (includeTime ? ', stateTime' : '') + ' FROM gc_progress WHERE actor = ?';
			var params = [actorId];

			state.datasources.db.getMany(query, params, null, function (err, results) {
				if (err) {
					return callback(err);
				}

				var len = results.length;
				for (var i = 0; i < len; i++) {
					var row = results[i];
					var node = nodesMap[row.node];

					if (node) {
						node.progress = includeTime ? { state: row.state, stateTime: row.stateTime } : row.state;
					}
				}

				callback();
			});
		},
		function (callback) {
			// load node actor-data

			var query = 'SELECT nodeId, property, type, value FROM gc_node_actor_data WHERE actorId = ? AND language IN (?, ?)';
			var params = [actorId, state.language(), ''];

			state.datasources.db.getMany(query, params, null, function (err, results) {
				if (err) {
					return callback(err);
				}

				var len = results.length;
				for (var i = 0; i < len; i++) {
					var row = results[i];
					var node = nodesMap[row.nodeId];

					if (node) {
						if (!node.actorData) {
							node.actorData = {};
						}

						node.actorData[row.property] = mithril.core.PropertyMap.unserialize(row.type, row.value);
					}
				}

				callback();
			});
		}
	],
	cb);
};


exports.getNodeProgress = function (state, actorId, nodeId, cb) {
	var query = 'SELECT state FROM gc_progress WHERE actor = ? AND node = ?';
	var params = [actorId, nodeId];

	state.datasources.db.getOne(query, params, false, null, function (error, row) {
		if (error) {
			return cb(error);
		}

		cb(null, row ? (row.state || null) : null);
	});
};


exports.getNodesProgress = function (state, nodeIds, actorId, cb) {
	if (!nodeIds || nodeIds.length === 0) {
		return cb(null, {});
	}

	var db = state.datasources.db;

	var result = {};

	var query = 'SELECT node, state FROM gc_progress WHERE actor = ? AND node IN (' + db.getPlaceHolders(nodeIds.length) + ')';
	var params = [actorId].concat(nodeIds);

	for (var i = 0, len = nodeIds.length; i < len; i++) {
		result[nodeIds[i]] = null;	// those not returned will be null
	}

	db.getMany(query, params, null, function (err, rows) {
		if (err) {
			return cb(err);
		}

		for (var i = 0, len = rows.length; i < len; i++) {
			var row = rows[i];

			result[row.node] = row.state;
		}

		cb(null, result);
	});
};


exports.loadNodeData = function (state, nodesMap, cb) {
	var query = 'SELECT node, property, language, type, value FROM gc_node_data';
	var params = [];

	state.datasources.db.getMany(query, params, null, function (err, results) {
		if (err) {
			return cb(err);
		}

		for (var id in nodesMap) {
			nodesMap[id].data = new mithril.core.PropertyMap();
		}

		var len = results.length;
		for (var i = 0; i < len; i++) {
			var row = results[i];

			if (row.node in nodesMap) {
				nodesMap[row.node].data.importOne(row.property, row.type, row.value, row.language);
			}
		}

		cb();
	});
};


exports.loadNodeInConnectors = function (state, nodesMap, cb) {
	var query = 'SELECT c.node, c.type, c.andGroup, ct.targetNode, ct.onState FROM gc_node_connector_in AS c JOIN gc_node_connector_in_target AS ct ON ct.connector = c.id';
	var params = [];

	state.datasources.db.getMany(query, params, null, function (err, results) {
		if (err) {
			return cb(err);
		}

		for (var id in nodesMap) {
			nodesMap[id].cin = {};
		}

		var len = results.length;
		for (var i = 0; i < len; i++) {
			var row = results[i];

			if (row.node in nodesMap) {
				var node = nodesMap[row.node];

				if (!(row.type in node.cin)) {
					node.cin[row.type] = {};
				}

				if (!(row.andGroup in node.cin[row.type])) {
					node.cin[row.type][row.andGroup] = [];
				}

				node.cin[row.type][row.andGroup].push({ targetNode: row.targetNode, onState: row.onState });
			}
		}

		cb();
	});
};


exports.loadNodeOutConnectors = function (state, nodesMap, cb) {
	var query = 'SELECT c.node, c.type, c.onState, ct.targetNode FROM gc_node_connector_out AS c JOIN gc_node_connector_out_target AS ct ON ct.connector = c.id';
	var params = [];

	state.datasources.db.getMany(query, params, null, function (err, results) {
		if (err) {
			return cb(err);
		}

		for (var id in nodesMap) {
			nodesMap[id].cout = {};
		}

		var len = results.length;
		for (var i = 0; i < len; i++) {
			var row = results[i];

			if (row.node in nodesMap) {
				var node = nodesMap[row.node];

				if (!(row.type in node.cout)) {
					node.cout[row.type] = {};
				}

				if (!(row.onState in node.cout[row.type])) {
					node.cout[row.type][row.onState] = [];
				}

				node.cout[row.type][row.onState].push(row.targetNode);
			}
		}

		cb();
	});
};


// GM commands


function flattenOutConnectors(node) {
	var outs = [];

	if (node.cout) {
		for (var type in node.cout) {
			var types = node.cout[type];

			for (var onState in types) {
				var onStates = types[onState];

				for (var i = 0, len = onStates.length; i < len; i++) {
					outs.push({ node: node.id, type: type, onState: onState, target: onStates[i] });
				}
			}
		}
	}

	return outs;
}


function flattenInConnectors() {

}


function addOutConnectors(state, connectors, cb) {
	var selectSql  = 'SELECT id from gc_node_connector_out WHERE node = ? AND type = ? AND onState = ?';
	var outSql     = 'INSERT INTO gc_node_connector_out (node, type, onState) VALUES (?, ?, ?)';
	var targetSql  = 'INSERT INTO gc_node_connector_out_target VALUES (?, ?)';

	async.forEachSeries(connectors, function (connector, callback) {
		var connectorId = null;
		var outParams = [connector.node, connector.type, connector.onState];

		// look for connector, create one if not found, add target to connector
		async.waterfall([
			function (connectorCallback) {
				var params = [].concat(outParams);
				state.datasources.db.getOne(selectSql, outParams, false, null, function (error, result) {
					if (error) {
						return connectorCallback(error);
					}

					connectorCallback(null, result, params);
				});
			},
			function (connectorTest, params, connectorCallback) {
				if (connectorTest === null) {
					state.datasources.db.exec(outSql, params, null, function (error, info) {
						if (error) {
							return connectorCallback(error);
						}

						connectorCallback(null, info.insertId);
					});
				} else {
					connectorId = connectorTest.id;
					connectorCallback(null, connectorId);
				}
			},
			function (connectorId, connectorCallback) {
				var targetParams = [connectorId, connector.target];
				state.datasources.db.exec(targetSql, targetParams, null, connectorCallback);
			}
		], callback);

	}, cb);
}


function delOutConnectors(state, connectors, cb) {
	// TODO -- Don't think I need this anymore, but just in case
	var delOutsSql   = 'DELETE co.* FROM gc_node_connector_out AS co LEFT JOIN gc_node_connector_out_target AS target ON co.id = target.connector WHERE target.targetNode IS NULL';
	var delTargetSql = 'DELETE target.* FROM gc_node_connector_out_target AS target JOIN gc_node_connector_out AS co ON co.id = target.connector WHERE co.node = ? AND co.type = ? AND co.onState = ? AND target.targetNode = ?';

	async.forEachSeries(connectors, function (connector, callback) {
		var params = [connector.node, connector.type, connector.onState, connector.target];
		state.datasources.db.exec(delTargetSql, params, null, callback);

	}, function (error) {
		if (error) {
			return cb(error);
		}

		state.datasources.db.exec(delOutsSql, [], null, function (error) {
			if (error) {
				return cb(error);
			}

			exports.setup(state, cb);
		});
	});
}


function addInConnectors(state, connectors, cb) {
	// TODO -- finish function
	cb();
}





function addCachedNodes(nodes) {
	for (var i = 0, len = nodes.length; i < len; i++) {
		var node = nodes[i];
		var data = node.data;

		var propMap = new mithril.core.PropertyMap();

		for (var i = 0, len = data.length; i < len; i++) {
			propMap.importOne(data[i].property, data[i].type, data[i].value, data[i].language || '');
		}

		node.data = propMap;

		allNodesMap[node.id] = node;
		allNodesIdentifiedMap[node.identifier] = node;

		allNodesArr.push(node);

		if (node.type in allNodesTypedArr) {
			allNodesTypedArr[node.type].push(node);
		} else {
			allNodesTypedArr[node.type] = [node];
		}
	}
}


function editCachedNodes(nodes) {
	for (var i = 0, len = nodes.length; i < len; i++) {
		var node = nodes[i];
		var data = node.data || [];

		var propMap = new mithril.core.PropertyMap();

		for (var i = 0, len = data.length; i < len; i++) {
			propMap.importOne(data[i].property, data[i].type, data[i].value, data[i].language || '');
		}

		node.data = propMap;

		allNodesMap[node.id] = node;
		allNodesIdentifiedMap[node.identifier] = node;

		for (var i = 0, len = allNodesArr.length; i < len; i++) {
			var arrNode = allNodesArr[i];
			if (node.id === arrNode.id) {
				arrNode = node;
			}
		}

		var typedNodeArr = allNodesTypedArr[node.type];

		for (var j = 0, jlen = typedNodeArr.length; j < jlen; j++) {
			var typeNode = typedNodeArr[j];
			if (node.id === typeNode.id) {
				typeNode = node;
			}
		}
	}
}


function delCachedNodes(ids) {
	for (var i = 0, len = ids.length; i < len; i++) {
		var id = ids[i];
		var identifier = allNodesMap[id].identifier;
		var type       = allNodesMap[id].type;

		delete allNodesMap[id];
		delete allNodesIdentifiedMap[identifier];

		for (var i = 0, len = allNodesArr.length; i < len; i++) {
			if (allNodesArr[i].id === id) {
				allNodesArr.splice(i, 1);
				break;
			}
		}

		var typeArr = allNodesTypedArr[type];
		if (typeArr) {
			for (var j = 0, len = typeArr.length; j < len; j++) {
				if (typeArr[j].id === id) {
					typeArr.splice(j, 1);
					break;
				}
			}

			if (typeArr.length === 0) {
				delete typeArr;
			}
		}
	}
}

exports.addNodes = function (state, nodes, cb) {
	var newNodes = [];
	var sql      = 'INSERT INTO gc_node (identifier, type) VALUES (?, ?)';
	var dataSql  = 'INSERT INTO gc_node_data VALUES (?, ?, ?, ?, ?)';


	async.forEachSeries(nodes, function (node, callback) {
		var identifier = uuid();
		var params     = [identifier].concat(node.type);

		state.datasources.db.exec(sql, params, null, function (error, info) {
			if (error) {
				return callback(error);
			}

			var data   = node.data || [];
			var nodeId = info.insertId;
			newNodes.push({ id: nodeId, identifier: identifier });

			node.id = nodeId;
			node.identifier = identifier;

			var outs = flattenOutConnectors(node);
			var ins  = flattenInConnectors(node);


			// async call to add data to the node, then add connectors
			async.series([
				function (extraCallback) {
					async.forEachSeries(data, function (property, dataCallback) {
						var dataParams = [nodeId, property.property, property.language || '', property.type, property.value];

						state.datasources.db.exec(dataSql, dataParams, null, function (error, info) {
							if (error) {
								return dataCallback(error);
							}

							dataCallback();
						});

					}, extraCallback);
				},
				function (extraCallback) {
					addOutConnectors(state, outs, extraCallback);
				},
				function (extraCallback) {
					addInConnectors(state, ins, extraCallback);
				}
			], callback);
		});
	}, function (error) {
		if (error) {
			return cb(error);
		}

		addCachedNodes(nodes);
		cb(null, newNodes);
	});
};


exports.editNodes = function (state, nodes, cb) {
	var clearSql     = 'DELETE FROM gc_node_data WHERE node in (' + state.datasources.db.getPlaceHolders(nodes.length)  + ')';
	var dataSql      = 'INSERT INTO gc_node_data VALUES (?, ?, ?, ?, ?)';
	var clearOutsSql = 'DELETE FROM gc_node_connector_out WHERE node in (' + state.datasources.db.getPlaceHolders(nodes.length) + ')';
	var clearInsSql  = 'DELETE FROM gc_node_connector_in WHERE node in (' + state.datasources.db.getPlaceHolders(nodes.length) + ')';
	var delNodes     = [];

	for (var i = 0, len = nodes.length; i < len; i++) {
		delNodes.push(nodes[i].id);
	}

	async.series([
		function (callback) {
			// clear in/out connectors and node data
			async.series([
				function (clearCb) {
					var del = delNodes.concat([]);		// this version of the mysql module deletes input parameters...
					state.datasources.db.exec(clearOutsSql, del, null, clearCb);
				},
				function (clearCb) {
					var del = delNodes.concat([]);
					state.datasources.db.exec(clearInsSql, del, null, clearCb);
				},
				function (clearCb) {
					state.datasources.db.exec(clearSql, delNodes, null, clearCb);
				}
			], callback);
		},
		function (callback) {
			// for each node, add out/in connectors, node data
			async.forEachSeries(nodes, function (node, nodeCallback) {
				var data   = node.data || [];
				var nodeId = node.id;

				var outs = flattenOutConnectors(node);
				var ins  = flattenInConnectors(node);

				async.series([
					function (procCallback) {
						addOutConnectors(state, outs, procCallback);
					},
					function (procCallback) {
						addInConnectors(state, ins, procCallback);
					},
					function (procCallback) {
						async.forEachSeries(data, function (property, dataCallback) {
							var params = [nodeId, property.property, property.language || '', property.type, property.value];
							state.datasources.db.exec(dataSql, params, null, function (error) {
								if (error) {
									return dataCallback(error);
								}

								dataCallback();
							});
						}, procCallback);
					}
				], nodeCallback);
			}, callback);
		}
	], function (error) {
		if (error) {
			return cb(error);
		}

		editCachedNodes(nodes);
		cb();
	});
};


exports.delNodes = function (state, nodes, cb) {
	var sql = 'DELETE FROM gc_node WHERE id IN (' + state.datasources.db.getPlaceHolders(nodes.length) + ')';
	var params = nodes.concat([]);

	state.datasources.db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		delCachedNodes(nodes);
		cb();
	});
};



