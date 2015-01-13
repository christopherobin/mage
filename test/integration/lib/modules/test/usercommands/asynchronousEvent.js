var mage = require('mage');

exports.access = 'user';

exports.params = ['echoId'];

exports.execute = function (state, echoId, cb) {
	var actorId = state.actorId;

	setTimeout(function () {
		var newState = new mage.core.State();
		newState.emit(actorId, 'asyncEvent', { hello: echoId });
		newState.close();
	}, 50);

	cb();
};
