var mage = require('../../../mage');

exports.params = ['id', 'name', 'weight', 'data'];

exports.execute = function (state, id, name, weight, data, cb) {

	mage.obj.editClass(state, id, name, weight, data, cb);

};