var mithril = require('../../../mithril');

exports.params = ['id', 'name', 'weight', 'data'];

exports.execute = function (state, id, name, weight, data, cb) {

	mithril.obj.editClass(state, id, name, weight, data, cb);

};