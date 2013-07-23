var mage = require('../../../mage');


exports.access = 'admin';

exports.params = [];


exports.execute = function (state, cb) {
	state.respond({
		matryoshka: mage.core.config.getMatryoshka(),
		rootPath: process.cwd()
	});

	cb();
};
