var mage = require('../../../mage');
var async   = require('async');

exports.params = ['itemObjects'];

exports.execute = function (state, itemObjects, cb) {
	var ids = [];

	async.forEachSeries(itemObjects, function (itemObject, callback) {
		mage.shop.addItemObject(state, itemObject.itemIdentifier, itemObject.className, itemObject.quantity, itemObject.tags, itemObject.data, function (errors, id) {
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

		mage.shop.setup(state, function (error) {
			if (error) {
				return cb(error);
			}

			state.respond(ids);
			cb();
		});
	});
};
