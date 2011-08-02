var mithril = require('../../../mithril.js');


exports.execute = function(state, p, cb)
{
	cb();
	mithril.quit();
};

