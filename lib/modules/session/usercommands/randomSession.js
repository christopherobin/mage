var mage = require('../../../mage');
var uuid = require('node-uuid');

exports.access = 'anonymous';

exports.execute = function (state, cb) {
	var actorId = uuid();

	mage.session.register(state, actorId, null, { access: 'anonymous' }, function (error, session) {
		if (error) {
			return cb(error);
		}

		var data = { session: session.getFullKey(), actorId: actorId };

		state.respond(data);

		cb();
	});
};
