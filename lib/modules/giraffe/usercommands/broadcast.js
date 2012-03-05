var mithril = require('../../../mithril');

exports.params = ['actorIds', 'message'];

exports.execute = function (state, actorIds, message, cb) {

	var doSend = function () {
		var messages = {}; //make messages obj { actorId: message }

		for (var i = 0, len = actorIds.length; i < len; i += 1) {
			messages[actorIds[i]] = '';
		}

		mithril.giraffe.postNotifications(messages, message, null);
		cb();
	};

	// if no actorIds, get all
	if (!actorIds || !actorIds.length) {

		var query = 'SELECT actor FROM player';
		var params = [];

		state.datasources.db.getMany(query, params, null, function (err, data) {
			if (err) {
				return cb(err);
			}
			actorIds = [];

			for (var i = 0, len = data.length; i < len; i += 1) {
				actorIds.push(data[i].actor);
			}
			doSend();
		});
	} else {
		doSend();
	}
};


