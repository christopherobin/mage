var mage = require('../../../mage');


exports.params = ['ids'];


exports.execute = function (state, ids, cb) {
	mage.msg.delMessages(state, ids, null, cb);
};

