var mithril = require('../../../mithril');


exports.execute = function (state, p, cb) {
	var resultArr = [];
	var resultMap = [];

	var nodes = mithril.gc.getAllNodesArr();

	for (var i = 0, len = nodes.length; i < len; i++) {
		var node = nodes[i];

		var newNode = { id: node.id, type: node.type };
		var connType;

		for (connType in node.cin) {
			newNode.cin = node.cin;
			break;
		}

		for (connType in node.cout) {
			newNode.cout = node.cout;
			break;
		}

		var data = node.data.getAllFull(true);

		for (var property in data) {
			newNode.data = data;
			break;
		}

		resultMap[node.id] = newNode;
		resultArr.push(newNode);
	}

	state.respond(resultArr);
	cb();
};

