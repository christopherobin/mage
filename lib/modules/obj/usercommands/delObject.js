var mithril = require('../../../mithril');
var async   = require('async');


exports.params = ['objId'];


exports.execute = function (state, objId, cb) {
	mithril.obj.delObject(state, objId, cb);
};

