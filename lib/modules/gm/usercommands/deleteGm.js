var mithril = require('../../../mithril');

exports.params = ['id'];

exports.execute = function (state, id, cb) {

	mithril.gm.delGm(state, id, cb);
};
