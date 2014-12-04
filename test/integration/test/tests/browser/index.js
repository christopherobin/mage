module.exports = function (cb) {
	describe('MAGE', function () {
		var mage = window.mage = require('mage.js');

		mage.httpServer.cmdMode = 'free';

		mage.setup(function (error) {
			if (error) {
				return cb(error);
			}

			try {
				require('./tests/testArchivist.js');
				require('./tests/testIdent');
				require('./tests/testLoader.js');
				require('./tests/testSession.js');
				require('./tests/testWebApp.js');
				require('./tests/testTime.js');
				require('./tests/testServerEvents.js');
			} catch (e) {
				return cb(e);
			}

			cb();
		});
	});
};
