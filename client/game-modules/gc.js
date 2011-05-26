function MithrilGameModGc(mithril)
{
	this.mithril = mithril;
	this.cacheMap = {};
	this.cacheArr = [];
}


MithrilGameModGc.prototype.setup = function(cb)
{
	var _this = this;

	this.mithril.io.on('gc.node.progress.edit', function(path, params) {
		if (params.nodeId in _this.cacheMap)
		{
			var node = _this.getNode(params.nodeId);

			node.progress = { state: params.state, stateTime: params.stateTime };

			params.type = node.type;
		}
	}, true);


	this.mithril.io.send('gc.loadNodes', { options: { loadProgressForActor: true, loadNodeData: true, loadInConnectors: true, loadOutConnectors: true } }, function(error, response) {
		if (error)
		{
			return cb(error);
		}

		_this.cacheMap = response;

		for (var id in response)
		{
			_this.cacheArr.push(response[id]);
		}

		cb();
	});
};


MithrilGameModGc.prototype.getNode = function(nodeId)
{
	return this.cacheMap[nodeId] || null;
};


MithrilGameModGc.prototype.getInRequirements = function(nodeId, type)
{
	// checks if the given node's inConnector of type "type" is set true/false based on the inConnector's requirements.

	var node = this.cacheMap[nodeId];

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
				var progress = this.cacheMap[cond.targetNode].progress;

				if (!(progress && progress.state == cond.onState))
				{
					groupRequired.push(this.cacheMap[cond.targetNode]);
				}
			}

			if (groupRequired.length == 0) return true;

			required.push(groupRequired);
		}

		return required;
	}

	return true;
};


MithrilGameModGc.prototype.filterNodes = function(filter, nextMatch, nodes)
{
	// filter nodes to only the required ones

	var result = [];

	if (!nodes) nodes = this.cacheArr;

	if (filter)
	{
		result = nodes.filter(filter);
	}

	if (!nextMatch)
	{
		return result;
	}

	var count = result.length;
	if (count == 0)
	{
		return result;
	}

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
			var nextNode = _this.cacheMap[nextNodeId];

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

