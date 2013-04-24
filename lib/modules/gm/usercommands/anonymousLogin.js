var mage = require('../../../mage');
var uuid = require('node-uuid');


exports.access = 'anonymous';


exports.execute = function (state, cb) {
	// TODO: make sure we are in develop mode

	var actorId = uuid();

	mage.session.register(state, actorId, null, { access: 'admin' }, function (error, session) {
		if (error) {
			return cb(error);
		}

		var data = { session: session.getFullKey(), actorId: actorId };

		state.respond(data);

		cb();
	});
};
