var mithril = require('../../../mithril');


exports.params = ['requestId'];


exports.execute = function (state, p, cb) {
	mithril.sns.delRelationRequest(state, p.requestId, function (error) {
		cb();
	});
};

