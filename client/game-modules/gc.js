function MithrilGameModGc(mithril)
{
	this.mithril = mithril;
	this.cache = null;
}


MithrilGameModGc.prototype.setup = function(cb)
{
	var _this = this;
	this.mithril.io.send('gc.loadNodes', { options: { loadProgressForActor: true, loadNodeData: true, loadInConnectors: true, loadOutConnectors: true } }, function(error, response) {
		if (error)
		{
			cb(error);
			return;
		}

		_this.cache = response;
		cb(null);
	});
};


MithrilGameModGc.prototype.getInRequirements = function(nodes, nodeId, type)
{
	// checks if the given node's inConnector of type "type" is set true/false based on the inConnector's requirements.

	var node = nodes[nodeId];

	if (node.inConnectors && node.inConnectors[type])
	{
		var connectors = node.inConnectors[type];
		var required = [];

		for (var groupId in connectors)
		{
			var group = connectors[groupId];
			var groupRequired = [];

			for (var i=0; i < group.length; i++)
			{
				var cond = group[i];
				var progress = nodes[cond.targetNode].progress;

				if (!(progress && progress.state == cond.onState))
				{
					groupRequired.push(nodes[cond.targetNode]);
				}
			}

			if (groupRequired.length == 0) return true;

			required.push(groupRequired);
		}

		return required;
	}

	return true;
};


MithrilGameModGc.prototype.filterNodes = function(nodes, filter, nextMatch)
{
	// filter nodes to only the required ones

	var result = [];

	for (var nodeId in nodes)
	{
		var node = nodes[nodeId];
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
			var nextNode = nodes[nextNodeId];

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

