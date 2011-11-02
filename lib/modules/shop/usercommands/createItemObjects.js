var mithril = require('../../../mithril');
var async   = require('async');

exports.execute = function (state, itemObjects, cb) {
	var ids = [];

	async.forEachSeries(itemObjects, function (itemObject, callback) {
		mithril.shop.addItemObject(state, itemObject, function (errors, id) {
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
