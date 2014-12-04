var mage = require('mage');

exports.access = 'user';

exports.params = [];

exports.execute = function (state, cb) {
	var actorId = state.actorId;

	setTimeout(function () {
		var newState = new mage.core.State();
		newState.emit(actorId, 'asyncEvent', { hello: 'async' });
		newState.close();
	}, 50);

	cb();
};
