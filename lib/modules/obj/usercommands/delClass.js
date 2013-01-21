var mage = require('../../../mage');

exports.params = ['id'];

exports.execute = function (state, id, cb) {

	mage.obj.delClass(state, id, cb);

};