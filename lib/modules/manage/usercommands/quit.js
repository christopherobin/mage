var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, p, cb) {
	cb();
	mithril.quit();
};

