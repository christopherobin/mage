var mithril = require('../../../mithril');
var async   = require('async');


exports.params = ['actor', 'colType', 'name', 'weight', 'tags', 'quantity'];


exports.execute = function (state, actor, colType, name, weight, tags, quantity, cb) {
	var objId;
	var collectionId;

	async.series([
		function (callback) {
			mithril.obj.addObject(state, name, weight, tags, quantity, function (error, obj) {
				if (error) {
					return callback(error);
				}

				if (obj && obj.length > 0) {
					objId = obj[0].id;
				}

				callback();
			});
		},
		function (callback) {
			mithril.obj.getCollectionByType(state, colType, actor, null, function (error, id) {
				if (error) {
					return callback(error);
				}

				collectionId = id;
				callback();
			});
		},
		function (callback) {
			mithril.obj.addObjToCollection(state, [{ id: objId }], collectionId, null, callback);
		}
	],

	function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};

