var mage = require('../../../mage');


exports.params = ['relationId'];


exports.execute = function (state, relationId, cb) {
	mage.sns.delRelation(state, relationId, function (error) {
		cb();
	});
};

