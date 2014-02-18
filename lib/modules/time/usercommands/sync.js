var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = ['clientTime'];


exports.execute = function (state, clientTime, cb) {
	var delta = 0;

	if (typeof clientTime === 'number') {
		delta = clientTime - Date.now();
	}

	state.respond({
		delta: delta,
		timer: mage.time.getConfig()
	});

	cb();
};
