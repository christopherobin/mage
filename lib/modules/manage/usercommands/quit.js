var mithril = require('../../../mithril');


exports.execute = function(state, p, cb)
{
	cb();
	mithril.quit();
};

