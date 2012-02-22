var gc = require('../../../mithril').gc;


exports.params = [];


// sync caches

var cache = {
	orgNodes: null,
	outNodes: null,
	nodeIds: null
};


// TODO: the out.outNodes cache is currently single language

exports.execute = function (state, cb) {
	// output:
	// {
	//   nodes: [{ id: '', type: 'NodeType', cin: ..., cout: ..., data: { key: value } }],
	//   progress: { id: 'progress', id: '..', id: '..' }
	//   actorData: { id: { key: value, key: value }, id: { key: value } }
	// }

	var out = {};	// JSON container
	var i, len;		// iterator helpers
	var nodeId;
	var nodeIds;
	var orgNodes;	// all nodes that need to be synced
	var orgNode;	// node object
	var newNode;	// a copy of node
	var connType;	// a connector type
	var data;		// temporary data holder
	var property;	// data iterator
	var nodesArr;	// list of newNode objects, to be serialized

	out = {};

	if (cache.orgNodes) {
		orgNodes = cache.orgNodes;
	} else {
		orgNodes = gc.hooks.getSyncNodes();
	}

	if (cache.outNodes) {
		out.nodes = cache.outNodes;
	} else {
		len = orgNodes.length;

		nodesArr = new Array(len);
		nodeIds = new Array(len);

		for (i = 0; i < len; i++) {
			orgNode = orgNodes[i];
			nodeId = orgNode.id;

			newNode = { id: nodeId, type: orgNode.type };

			for (connType in orgNode.cin) {
				newNode.cin = orgNode.cin;
				break;
			}

			for (connType in orgNode.cout) {
				newNode.cout = orgNode.cout;
				break;
			}

			if (orgNode.data) {
				data = orgNode.data.getAll(state.language());

				for (property in data) {
					newNode.data = data;
					break;
				}
			}

			nodeIds[i] = nodeId;
			nodesArr[i] = newNode;
		}

		out.nodes = cache.outNodes = JSON.stringify(nodesArr);
		cache.nodeIds = nodeIds;
	}

	gc.loadNodeActorData(state, cache.nodeIds, state.actorId, function (error, actorData) {
		if (error) {
			return cb(error);
		}

		out.actorData = actorData;

		// respond

		var response = '{"nodes":' + out.nodes + ',"actorData":' + out.actorData + '}';

		state.respondJson(response);

		cb();
	});
};

