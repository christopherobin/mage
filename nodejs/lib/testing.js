
exports.getState = function()
{
	return new mithril.core.state.State(null, null, new mithril.core.datasources.DataSources);
}

