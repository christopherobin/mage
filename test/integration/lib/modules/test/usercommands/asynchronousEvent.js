var mage = require('mage');

exports.access = 'user';

exports.params = ['uuid'];

exports.execute = function (state, uuid, cb) {
	var actorId = state.actorId;

	setTimeout(function () {
		var newState = new mage.core.State();
		newState.emit(actorId, 'asyncEvent', { hello: uuid });
		newState.close();
	}, 50);

	cb();
};
