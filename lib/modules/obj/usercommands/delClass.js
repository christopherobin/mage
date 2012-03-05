var mithril = require('../../../mithril');

exports.params = ['id'];

exports.execute = function (state, id, cb) {

	mithril.obj.delClass(state, id, cb);

};