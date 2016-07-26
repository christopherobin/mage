var mage = require('mage');

exports.acl = ['user'];

exports.params = [];

exports.execute = function (state, cb) {
	var actorId = state.actorId;

	cb();

	state = new mage.core.State();
	mage.session.getActorSession(state, actorId, function (error, session) {
		if (error) {
			throw error;
		}

		session.clusterId = 'NO_SUCH_CLUSTER';

		state.archivist.set('session', { actorId: actorId }, session, null, null, mage.session.getNewExpirationTime());
		state.archivist.distribute(function () {
			state.emit(actorId, 'foo', { hello: 'bar' });
			state.close();
		});
	});
};
