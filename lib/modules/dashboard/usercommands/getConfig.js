var mage = require('../../../mage');


exports.acl = ['admin'];

exports.params = [];


exports.execute = function (state, cb) {
	state.respond({
		matryoshka: mage.core.config.getMatryoshka(),
		rootPath: process.cwd()
	});

	cb();
};
