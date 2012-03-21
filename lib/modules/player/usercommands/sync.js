var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, cb) {
	// we used to sync only language, but now that's part of actor (not player)
	// for BC, we still respond, but it's an empty object

	state.respondJson('{"me":{}}');
	cb();
};

