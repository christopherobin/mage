var mage = require('../../../mage');
var async   = require('async');


exports.params = ['actor', 'colType', 'name', 'weight', 'tags', 'quantity'];


exports.execute = function (state, actor, collectionId, name, weight, tags, quantity, cb) {
	var objIds;

	async.series([
		function (callback) {
			mage.obj.addObject(state, name, weight, tags, quantity, function (error, objs) {
				if (error) {
					return callback(error);
				}

				objIds = objs;
				callback();
			});
		},
		function (callback) {
			mage.obj.addObjectsToCollection(state, objIds, collectionId, null, callback);
		}
	],
	function (error) {
		if (error) {
			return cb(error);
		}

		var ids = [];

		for (var i = 0, len = objIds.length; i < len; i++) {
			ids.push(objIds[i].id);
		}

		state.respond(ids);
		cb();
	});
};

