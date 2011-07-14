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
		var node = _this.cacheMap[params.nodeId];
		if (node)
		{
			node.progress = params.state;
			params.node = node;
		}
	}, true);


	this.mithril.io.send('gc.sync', {}, function(error, response) {
		if (error) return cb(error);

		_this.cacheArr = response;
		_this.cacheMap = {};

		var len = response.length;
		for (var i=0; i < len; i++)
		{
			var node = response[i];

			_this.cacheMap[node.id] = node;
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

				if (progress !== cond.onState)
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


MithrilGameModGc.prototype.findInEffectedNodes = function(nodeId, type)
{
	var checkNode = function(node, result)
	{
		if (node.id != nodeId && node.cin && node.cin[type])
		{
			var connectors = node.cin[type];

			for (var groupId in connectors)
			{
				var group = connectors[groupId];

				for (var j=0; j < group.length; j++)
				{
					if (group[j].targetNode == nodeId)
					{
						result.push(node.id);
						return;
					}
				}
			}
		}
	};

	var result = [];
	var len = this.cacheArr.length;

	for (var i=0; i < len; i++)
	{
		checkNode(this.cacheArr[i], result);
	}

	return result;
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
	else
		result = nodes.concat([]);	// make a copy

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

