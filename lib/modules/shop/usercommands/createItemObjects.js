var mithril = require('../../../mithril');
var async   = require('async');

exports.params = ['itemObjects'];

exports.execute = function (state, itemObjects, cb) {
	var ids = [];

	async.forEachSeries(itemObjects, function (itemObject, callback) {
		mithril.shop.addItemObject(state, itemObject.itemIdentifier, itemObject.className, itemObject.quantity, itemObject.tags, itemObject.data, function (errors, id) {
			if (errors) {
				return callback(errors);
			}

			ids.push(id);
			callback();
		});

	}, function (errors) {
		if (errors) {
			return cb(errors);
		}

		state.respond(ids);
		cb();
	});
};
