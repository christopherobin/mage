module.exports = function (cb) {
	describe('MAGE', function () {
		var mage = require('mage');

		mage.httpServer.cmdMode = 'free';

		mage.setup(function (error) {
			if (error) {
				return cb(error);
			}

			try {
				require('./tests/testArchivist.js');
				require('./tests/testEventManager');
				require('./tests/testIdent');
				require('./tests/testLoader.js');
				require('./tests/testSession.js');
				require('./tests/testWebApp.js');
				require('./tests/testTime.js');
			} catch (e) {
				return cb(e);
			}

			cb();
		});
	});
};
