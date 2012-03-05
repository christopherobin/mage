var mithril = require('../../../mithril');

exports.params = ['giraffeId'];

exports.execute = function (state, giraffeId, cb) {

	mithril.giraffe.getUserProperties(state, giraffeId, { load: ['actorId'] }, function (err, data) {
		if (err) {
			return cb(err);
		}

		state.respond(data.get('actorId'));
		cb();
	});

};
