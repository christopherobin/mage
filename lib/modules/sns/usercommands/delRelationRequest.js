var mage = require('../../../mage');


exports.params = ['requestId'];


exports.execute = function (state, requestId, cb) {
	mage.sns.delRelationRequest(state, requestId, function (error) {
		cb();
	});
};

