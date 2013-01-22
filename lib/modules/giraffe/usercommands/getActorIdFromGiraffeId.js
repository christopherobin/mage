var mage = require('../../../mage');

exports.params = ['giraffeId'];

exports.execute = function (state, giraffeId, cb) {

	mage.giraffe.getUserProperties(state, giraffeId, { load: ['actorId'] }, function (err, data) {
		if (err) {
			return cb(err);
		}

		state.respond(data.get('actorId'));
		cb();
	});

};
