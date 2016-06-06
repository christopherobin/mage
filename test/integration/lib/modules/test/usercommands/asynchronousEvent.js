var mage = require('mage');

exports.acl = ['user'];

exports.params = ['echoId'];

exports.execute = function (state, echoId, cb) {
	var actorId = state.actorId;

	cb();

	setTimeout(function () {
		var newState = new mage.core.State();
		newState.emit(actorId, 'asyncEvent', { hello: echoId });
		newState.close();
	}, 50);
};
