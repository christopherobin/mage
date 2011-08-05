var mithril = require('../../../mithril');


exports.execute = function(state, p, cb)
{
	mithril.persistent.clear(state, cb);
};

