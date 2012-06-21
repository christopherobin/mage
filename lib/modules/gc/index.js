var mithril = require('../../mithril');
var uuid    = require('node-uuid');
var async   = require('async');

var allNodesMap = null;
var allNodesIdentifiedMap = null;
var allNodesArr = null;
var allNodesTypedArr = null;


exports.hooks = {
	getSyncNodes: function () {
		return allNodesArr;
	}
};


exports.getManageCommands = function () {
	return [
		'gmsync',
		'addNodes',
		'editNodes',
		'delNodes'
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

			exports.getNodeActorProperties(state, nodeId, actorId, {}, function (error, data) {
				if (error) {
					return cb(error);
				}

				data.set('progress', newState);
				cb();
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

		var newProgress = ~~progress + ~~increment;

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
		var newProgress = '' + fnReplace(progress); // transform into a new value and cast to string

		if (newProgress === progress) { // If the value did not change, we do not have to write to disc. A progressChanged event will still fire however.
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

	exports.getNodeActorProperties(state, nodeId, actorId, {}, function (error, propMap) {
		if (error) {
			return cb(error);
		}

		propMap.del('progress');
		cb();
	});
};


exports.getNodeActorProperties = function (state, nodeId, actorId, options, cb) {
	var domain = {
		id: nodeId,
		key: 'gc/node/' + nodeId + '/actor/' + actorId,
		events: { actorIds: [actorId] }
	};

	mithril.core.LivePropertyMap.create(state, domain, options, cb);
};


exports.getNodesActorProperties = function (state, nodeIds, actorId, options, cb) {
	var len = nodeIds.length;

	var domains = new Array(len);

	for (var i = 0; i < len; i++) {
		var nodeId = nodeIds[i];

		domains[i] = {
			id: nodeId,
			key: 'gc/node/' + nodeId + '/actor/' + actorId,
			events: { actorIds: [actorId] }
		};
	}

	mithril.core.LivePropertyMap.createMany(state, domains, options, cb);
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
			return cb(null, nodesMap, nodesIdentifiedMap, nodesArr, nodesTypedArr);
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

/*
exports.loadFullProgress = function (state, actorId, cb) {
	// load node progress

	var query = 'SELECT node, state FROM gc_progress WHERE actor = ?';
	var params = [actorId];

	state.datasources.db.getMapped(query, params, { key: 'node', value: 'state' }, null, cb);
};
*/

exports.loadNodeActorData = function (state, nodeIds, actorId, cb) {
	// load node actor-data

	exports.getNodesActorProperties(state, nodeIds, actorId, { loadAll: true, mapsAreOptional: true }, function (error, pms) {
		if (error) {
			return cb(error);
		}

		var json = [];

		for (var nodeId in pms) {
			var values = pms[nodeId].stringify(state.language());

			if (values.length > 2) {
				json.push('"' + nodeId + '":' + values);
			}
		}

		cb(null, '{' + json.join(',') + '}');
	});
};


exports.getNodeProgress = function (state, actorId, nodeId, cb) {
	//WARNING inconsistent parameter order in this module!
	exports.getNodeActorProperties(state, nodeId, actorId, { optional: ['progress']}, function (error, data) {
		if (error) {
			return cb(error);
		}

		var state = data.get('progress');
		if (state) {
			state = "" + state;
		}

		cb(null, state);
	});
};


exports.getNodesProgress = function (state, nodeIds, actorId, cb) {
	if (!nodeIds || nodeIds.length === 0) {
		return cb(null, {});
	}

	var result = {};

	exports.getNodesActorProperties(state, nodeIds, actorId, { load: ['progress'] }, function (error, data) {
		if (error) {
			return cb(error);
		}

		for (var nodeId in data) {
			result[nodeId] = data[nodeId].get('progress');
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
			nodesMap[id].rcout = {};
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


				// add reverse lookup (maybe only do this if passed in an option?)
				var targetNode = nodesMap[row.targetNode];
				if (targetNode) {
					if (!(row.type in targetNode.rcout)) {
						targetNode.rcout[row.type] = [];
					}

					targetNode.rcout[row.type].push({ nodeId: node.id, node: node, state: row.onState });
				}
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


exports.addOutConnectors = function (state, connectors, cb) {
	// Note: calling this externally won't update the local cache

	async.forEachSeries(
		connectors,
		function (connector, callback) {
			var outSql      = 'INSERT INTO gc_node_connector_out (node, type, onState) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)';
			var outParams   = [connector.node, connector.type, connector.onState];


			// look for connector, create one if not found, add target to connector

			state.datasources.db.exec(outSql, outParams, null, function (error, info) {
				if (error) {
					return callback(error);
				}


				var targetSql    = 'INSERT IGNORE INTO gc_node_connector_out_target VALUES (?, ?)';
				var targetParams = [info.insertId, connector.target];

				state.datasources.db.exec(targetSql, targetParams, null, callback);

			});
		},
		cb
	);
};


// addCachedNodes adds nodes to the cache and returns the added nodes in a format that they can be emitted to the client

function addCachedNodes(nodes) {
	var len = nodes.length;
	var addedNodes = new Array(len);

	for (var i = 0; i < len; i++) {
		var node = nodes[i];
		var data = node.data;

		var propMap = new mithril.core.PropertyMap();

		for (var j = 0, jlen = data.length; j < jlen; j++) {
			propMap.importOne(data[j].property, data[j].type, data[j].value, data[j].language || '');
		}

		node.data = propMap;

		allNodesMap[node.id] = node;
		allNodesIdentifiedMap[node.identifier] = node;

		if (!Array.isArray(allNodesArr)) {
			allNodesArr = [];
		}

		if (!allNodesTypedArr) {
			allNodesTypedArr = [];
		}

		allNodesArr.push(node);

		if (node.type in allNodesTypedArr) {
			allNodesTypedArr[node.type].push(node);
		} else {
			allNodesTypedArr[node.type] = [node];
		}

		// copy node to emit to clients
		addedNodes[i] = {
			id: node.id,
			type: node.type,
			cin: node.cin,
			cout: node.cout,
			data: node.data ? node.data.getAllFlat(true) : {}
		};
	}

	return addedNodes;
}


// editCachedNodes edits cached nodes and returns an array of nodes edited in a format that can be emitted to the client

function editCachedNodes(nodes) {
	var len = nodes.length;
	var editedNodes = new Array(len);

	for (var i = 0; i < len; i++) {
		var node = nodes[i];
		var data = node.data || [];

		var propMap = new mithril.core.PropertyMap();

		for (var j = 0, jlen = data.length; j < jlen; j++) {
			propMap.importOne(data[j].property, data[j].type, data[j].value, data[j].language || '');
		}

		node.data = propMap;

		allNodesMap[node.id] = node;
		allNodesIdentifiedMap[node.identifier] = node;

		for (var k = 0, klen = allNodesArr.length; k < klen; k++) {
			var arrNode = allNodesArr[k];
			if (node.id === arrNode.id) {
				allNodesArr[k] = node;
			}
		}

		var typedNodeArr = allNodesTypedArr[node.type];

		for (var l = 0, llen = typedNodeArr.length; l < llen; l++) {
			var typeNode = typedNodeArr[l];
			if (node.id === typeNode.id) {
				typeNode = node;
			}
		}

		editedNodes[i] = {
			id: node.id,
			type: node.type,
			cin: node.cin,
			cout: node.cout,
			data: node.data ? node.data.getAllFlat(true) : {}
		};
	}

	return editedNodes;
}


function delCachedNodes(ids) {
	for (var i = 0, len = ids.length; i < len; i++) {
		var id = ids[i];
		var identifier = allNodesMap[id].identifier;
		var type       = allNodesMap[id].type;

		delete allNodesMap[id];
		delete allNodesIdentifiedMap[identifier];

		for (var j = 0, jlen = allNodesArr.length; j < jlen; j++) {
			if (allNodesArr[j].id === id) {
				allNodesArr.splice(i, 1);
				break;
			}
		}

		var typeArr = allNodesTypedArr[type];
		if (typeArr) {
			for (var k = 0, klen = typeArr.length; k < klen; k++) {
				if (typeArr[k].id === id) {
					typeArr.splice(k, 1);
					break;
				}
			}

			if (typeArr.length === 0) {
				delete allNodesTypedArr[type];
			}
		}
	}

	return ids;
}



function addInConnectors(state, connectors, cb) {
	// TODO -- finish function
	cb();
}


function addOutReferences(nodes) {
	var editedNodes = [];

	for (var i = 0, len = nodes.length; i < len; i++) {
		var node = allNodesMap[nodes[i]];
	}

	return editedNodes;
}


// Goes through and removes any references to node. inout is cout or rcout (reverse cout)
function clearOutReference(node, inout) {
	var editedNodes = [];
	var rinout = (inout === 'cout') ? 'rcout' : 'cout';

	if (node[inout]) {
		var types = node[inout];

		for (var type in types) {
			var states = types[type];

			for (var state in states) {
				var targets = states[state];

				for (var j = 0, jlen = targets.length; j < jlen; j++) {

					if (allNodesMap[targets[j]]) {
						var target = allNodesMap[targets[j]];

						if (target[rinout] && target[rinout][type] && target[rinout][type][state]) {
							// remove target, remove property if empty
							var rtargets = target[rinout][type][state];
							var rIndex   = rtargets.indexOf(node.id);

							if (rIndex !== -1) {
								rtargets.splice(rIndex, 1);
								editedNodes.push(target);
							}

							if (rtargets.length === 0) {
								delete target[rinout][type][state];
							}

							if (Object.keys(target[rinout][type]).length === 0) {
								delete target[rinout][type];
							}
						}
/*
					} else {
						// node points to non-existing node
						// TODO: throw some kinda error here
*/
					}
				}
			}
		}
	}

	return editedNodes;
}


function clearOutReferences(nodes) {
	var editedNodes = [];

	for (var i = 0, len = nodes.length; i < len; i++) {
		var node = allNodesMap[nodes[i]];
		clearOutReference(node, 'cout');
		editedNodes.concat(clearOutReference(node, 'rcout'));		// concat nodes that have changed
	}

	return editedNodes;
}



function handleAddedNodes(state, nodes) {
	var addedNodes  = addCachedNodes(nodes);
	var editedNodes = addOutReferences(nodes);

	// TODO -- emit to all actors logged in
	state.emitToActors([state.actorId], 'gc.nodesAdded',  addedNodes);
	state.emitToActors([state.actorId], 'gc.nodesEdited', editedNodes);
}


function handleEditedNodes(state, nodes) {
	var editedNodes = editCachedNodes(nodes);
	editedNodes.concat(addOutReferences(nodes));

	// TODO -- emit to all actors logged in
	state.emitToActors([state.actorId], 'gc.nodesEdited', editedNodes);
}


function handleDeletedNodes(state, nodes) {
	var editedNodes  = clearOutReferences(nodes);
	var deletedNodes = delCachedNodes(nodes);

	// TODO -- emit to all actors logged in
	state.emitToActors([state.actorId], 'gc.nodesDeleted', deletedNodes);
	state.emitToActors([state.actorId], 'gc.nodesEdited',  editedNodes);
}


exports.replaceNodes = function (state, nodes, cb) {
	var addNodes = [];
	var editNodes = [];

	for (var i = 0, len = nodes.length; i < len; i++) {
		var node = nodes[i];

		if (node.id || (node.identifier && exports.getNodeByIdentifier(node.identifier))) {
			editNodes.push(node);
		} else {
			addNodes.push(node);
		}
	}

	exports.addNodes(state, addNodes, function (error) {
		if (error) {
			return cb(error);
		}

		exports.editNodes(state, editNodes, cb);
	});
};


exports.addNodes = function (state, nodes, cb) {
	if (nodes.length === 0) {
		return cb();
	}

	var newNodes = [];
	var sql      = 'INSERT INTO gc_node (identifier, type) VALUES (?, ?)';


	async.forEachSeries(nodes, function (node, callback) {
		var identifier = node.identifier || uuid();
		var params     = [identifier, node.type];

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
					var dataSql     = 'INSERT INTO gc_node_data (node, property, language, type, value) VALUES ';
					var frag        = [];
					var dataParams  = [];
					var len         = data.length;

					if (len === 0) {
						return extraCallback();
					}

					for (var i = 0; i < len; i++) {
						var property = data[i];
						frag.push('(?, ?, ?, ?, ?)');
						dataParams.push(nodeId, property.property, property.language || '', property.type, property.value);
					}

					dataSql += frag.join(', ');

					state.datasources.db.exec(dataSql, dataParams, null, extraCallback);
				},
				function (extraCallback) {
					exports.addOutConnectors(state, outs, extraCallback);
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

		handleAddedNodes(state, nodes);
		cb();
	});
};


exports.editNodes = function (state, nodes, cb) {
	if (nodes.length === 0) {
		return cb();
	}

	var placeHolder  = state.datasources.db.getPlaceHolders(nodes.length);
	var clearSql     = 'DELETE FROM gc_node_data WHERE node in (' + placeHolder  + ')';
	var clearOutsSql = 'DELETE FROM gc_node_connector_out WHERE node in (' + placeHolder + ')';
	var clearInsSql  = 'DELETE FROM gc_node_connector_in WHERE node in (' + placeHolder + ')';

	var delNodes     = [];

	for (var i = 0, len = nodes.length; i < len; i++) {
		var node = nodes[i];

		// assign a node ID if we currently only have an identifier

		if (!node.id) {
			if (!node.identifier) {
				return state.error(null, 'Cannot edit a node if neither id or identifier are specified.', cb);
			}

			var cachedNode = allNodesIdentifiedMap[node.identifier];

			if (!cachedNode) {
				return state.error(null, 'Node with identifier "' + node.identifier + '" not found in cache.', cb);
			}

			node.id = cachedNode.id;
		}

		// add the node to the list of node IDs from which we'll delete information

		delNodes.push(node.id);
	}

	async.series([
		function (callback) {
			// clear in/out connectors and node data
			async.series([
				function (clearCb) {
					var del = delNodes.concat([]);		// this version of the mysql module deletes input parameters...
					state.datasources.db.exec(clearOutsSql, del, null, function (error) {
						if (error) {
							return clearCb(error);
						}

						clearOutReferences(delNodes);
						clearCb();
					});
				},
				function (clearCb) {
					var del = delNodes.concat([]);
					state.datasources.db.exec(clearInsSql, del, null, function (error) {
						if (error) {
							return clearCb(error);
						}


						// TODO: clearInReferences(delNodes);
						clearCb();
					});
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
				var cachedNode = allNodesMap[node.id];

				if (!cachedNode) {
					return state.error(null, 'Node ' + node.id + ' not found in cache.', nodeCallback);
				}

				var outs = flattenOutConnectors(node);
				var ins  = flattenInConnectors(node);

				async.series([
					function (procCallback) {
						// Add outs and update cache
						exports.addOutConnectors(state, outs, function (error) {
							if (error) {
								return procCallback(error);
							}


							cachedNode.cout = node.cout;
							procCallback();
						});
					},
					function (procCallback) {
						// Add Ins and update cache
						addInConnectors(state, ins, function (error) {
							if (error) {
								return procCallback(error);
							}


							cachedNode.cin = node.cin;
							procCallback();
						});
					},
					function (procCallback) {
						// Add data

						var dataSql     = 'INSERT INTO gc_node_data VALUES ';
						var frag        = [];
						var dataParams  = [];
						var len         = data.length;


						if (len === 0) {
							cachedNode.data = new mithril.core.PropertyMap();
							return procCallback();
						}


						for (var i = 0; i < len; i++) {
							var property = data[i];
							frag.push('(?, ?, ?, ?, ?)');
							dataParams.push(cachedNode.id, property.property, property.language || '', property.type, property.value);
						}

						dataSql += frag.join(', ');

						state.datasources.db.exec(dataSql, dataParams, null, function (error) {
							if (error) {
								return procCallback(error);
							}

							var propMap = new mithril.core.PropertyMap();

							for (var j = 0, jlen = data.length; j < jlen; j++) {
								propMap.importOne(data[j].property, data[j].type, data[j].value, data[j].language || '');
							}

							cachedNode.data = propMap;

							procCallback();
						});
					}
				], nodeCallback);
			}, callback);
		}
	], function (error) {
		if (error) {
			return cb(error);
		}

		handleEditedNodes(state, nodes);
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

		handleDeletedNodes(state, nodes);
		cb();
	});
};


