var mithril = require('../../../mithril');


exports.params = ['requestId'];


exports.execute = function (state, requestId, cb) {
	mithril.sns.delRelationRequest(state, requestId, function (error) {
		cb();
	});
};

