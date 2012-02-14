var mithril = require('../../../mithril');


exports.params = ['ids'];


exports.execute = function (state, ids, cb) {
	mithril.msg.delMessages(state, ids, null, cb);
};

