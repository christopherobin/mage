var mage = require('../../../mage');
var async   = require('async');


exports.params = ['objId'];


exports.execute = function (state, objId, cb) {
	mage.obj.delObject(state, objId, cb);
};

