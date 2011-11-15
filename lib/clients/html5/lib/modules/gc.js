(function () {

	var mithril = window.mithril;

	var mod = {};

	mithril.registerModule('gc', mod);


	var cacheMap = {};
	var cacheArr = [];


	mod.sync = function (cb) {
		mithril.io.send('gc.sync', {}, null, function (error, response) {
			if (error) {
				return cb(error);
			}

			cacheArr = response;
			cacheMap = {};

			for (var i = 0, len = response.length; i < len; i++) {
				var node = response[i];

				cacheMap[node.id] = node;
			}

			cb();
		});
	};


	mod.setup = function (cb) {
		mithril.io.on('gc.node.progress.edit', function (path, params) {
			var node = cacheMap[params.nodeId];
			if (node) {
				node.progress = params.state;
				params.node = node;
			}
		}, true);


		mithril.io.on('gc.node.progress.del', function (path, params) {
			var node = cacheMap[params.nodeId];
			if (node) {
				delete node.progress;
				params.node = node;
			}
		}, true);


		mithril.io.on('gc.node.actorData.edit', function (path, params) {
			var node = cacheMap[params.nodeId];
			if (node) {
				node.actorData = node.actorData || {};

				for (var key in params) {
					node.actorData[key] = params[key];
				}

				params.node = node;
			}
		}, true);


		mithril.io.on('gc.node.actorData.del', function (path, params) {
			var node = cacheMap[params.nodeId];
			if (node) {
				if (node.actorData) {
					for (var i = 0, len = params.length; i < len; i++) {
						delete node.actorData[params[i]];
					}
				}

				params.node = node;
			}
		}, true);


		mod.sync(cb);
	};


	mod.getNode = function (nodeId) {
		return cacheMap[nodeId] || null;
	};


	mod.filterNodes = function (filter, nextMatch, nodes) {
		// filter nodes to only the required ones

		var result = [];

		nodes = nodes || cacheArr;

		if (filter) {
			result = nodes.filter(filter);
		} else {
			result = nodes.concat([]);	// make a copy
		}

		if (!nextMatch) {
			return result;
		}

		var count = result.length;
		if (count === 0) {
			return result;
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
				var nextNode = cacheMap[nextNodeId];

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
			addToResult(out, result, i);
		}

		return out;
	};


	mod.getInRequirements = function (nodeId, type) {
		// checks if the given node's inConnector of type "type" is set true/false based on the inConnector's requirements.

		var node = cacheMap[nodeId];

		if (node.cin && node.cin[type]) {
			var connectors = node.cin[type];
			var required = [];

			for (var groupId in connectors) {
				var group = connectors[groupId];
				var groupRequired = [];

				for (var i = 0; i < group.length; i++) {
					var cond = group[i];
					var progress = cacheMap[cond.targetNode].progress;

					if (progress !== cond.onState) {
						groupRequired.push(cacheMap[cond.targetNode]);
					}
				}

				if (groupRequired.length === 0) {
					return true;
				}

				required.push(groupRequired);
			}

			return required;
		}

		return true;
	};


	mod.findInEffectedNodes = function (nodeId, type) {
		nodeId = ~~nodeId;

		var checkNode = function (node, result) {

			if (node.id !== nodeId && node.cin) {
				var connectors = node.cin[type];

				if (connectors) {
					for (var groupId in connectors) {
						var group = connectors[groupId];

						for (var i = 0; i < group.length; i++) {
							if (group[i].targetNode === nodeId) {
								result.push(node.id);
								return;
							}
						}
					}
				}
			}
		};

		var result = [];
		var len = cacheArr.length;

		for (var i = 0; i < len; i++) {
			checkNode(cacheArr[i], result);
		}

		return result;
	};


	mod.getSourceNodes = function (nodeId, connector) {
		return mithril.gc.filterNodes(
			function (node) {
				var conn = node.cout ? node.cout[connector] : null;
				if (conn) {
					for (var state in conn) {
						if (conn[state].indexOf(nodeId) !== -1) {
							return true;
						}
					}
				}

				return false;
			}
		);
	};


	mod.getOutNodes = function (nodeId, connector, allowedTypes, recursive) {
		// this function returns the first cout-connected node:
		// - if allowedTypes is not given OR
		// - is of a type mentioned in allowedTypes OR
		// - if recursive is TRUE, one of the non-valid nodes is tried

		var result = [];

		var node = this.getNode(nodeId);
		if (!node || !node.cout) {
			return result;
		}

		var conn = node.cout[connector];
		if (!conn) {
			return result;
		}

		for (var state in conn) {
			var nodes = conn[state];

			for (var i = 0, len = nodes.length; i < len; i++) {
				var connNode = this.getNode(nodes[i]);

				if (connNode) {
					if (!allowedTypes || allowedTypes.indexOf(connNode.type) !== -1) {
						// the found node is of an allowed type, return it

						result.push(connNode);
					} else if (recursive) {
						// the found node is of a wrong type, search recursively

						result = result.concat(this.getOutNodes(connNode.id, connector, allowedTypes, recursive));
					}
				}
			}
		}

		return result;
	};

}());
