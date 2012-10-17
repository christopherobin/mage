var mithril = require('../../../mithril');

exports.params = ['names'];

exports.execute = function (state, names, cb) {
	state.respond(mithril.assets.AssetMap.query(names));
	cb();
};
