function MithrilGameModGc(mithril)
{
	this.mithril = mithril;
	this.cache = {};
}


MithrilGameModGc.prototype.setup = function(cb)
{
	var _this = this;

	this.mithril.io.on('gc.node.progress.edit', function(path, params) {
		if (!_this.cache) return;

		if (params.nodeId in _this.cache)
		{
			_this.cache[params.nodeId].progress = { state: params.state, stateTime: params.stateTime };
			var node = _this.getNode(params.nodeId);
			params.type = node.type;
		}

	}, true);


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


MithrilGameModGc.prototype.getNode = function(nodeId)
{
	return (nodeId in this.cache) ? this.cache[nodeId] : null;
};


MithrilGameModGc.prototype.getInRequirements = function(nodeId, type)
{
	// checks if the given node's inConnector of type "type" is set true/false based on the inConnector's requirements.

	var node = this.cache[nodeId];

	if (node.cin && node.cin[type])
	{
		var connectors = node.cin[type];
		var required = [];

		for (var groupId in connectors)
		{
			var group = connectors[groupId];
			var groupRequired = [];

			for (var i=0; i < group.length; i++)
			{
				var cond = group[i];
				var progress = this.cache[cond.targetNode].progress;

				if (!(progress && progress.state == cond.onState))
				{
					groupRequired.push(this.cache[cond.targetNode]);
				}
			}

			if (groupRequired.length == 0) return true;

			required.push(groupRequired);
		}

		return required;
	}

	return true;
};


MithrilGameModGc.prototype.filterNodes = function(filter, nextMatch)
{
	// filter nodes to only the required ones

	var result = [];

	for (var nodeId in this.cache)
	{
		var node = this.cache[nodeId];
		if (filter(node))
			result.push(node);
	}

	var count = result.length;

	if (!nextMatch || count == 0) return result;

	// sort nodes

	var _this = this;

	function addToResult(out, filtered, i)
	{
		if (!filtered[i]) return -1;

		var node = filtered[i];
		var index;

		filtered[i] = null;

		var nextNodeId = nextMatch(node);
		if (nextNodeId)
		{
			var nextNode = _this.cache[nextNodeId];

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

