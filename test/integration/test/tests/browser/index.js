module.exports = function (cb) {
	describe('MAGE', function () {
		var mage = window.mage = require('mage');

		mage.httpServer.cmdMode = 'free';

		mage.setup(function (error) {
			if (error) {
				return cb(error);
			}

			try {
				require('./tests/testArchivist.js');
				require('./tests/testHttpServer.js');
				require('./tests/testIdent.js');
				require('./tests/testLoader.js');
				require('./tests/testModules.js');
				require('./tests/testServerEvents.js');
				require('./tests/testSession.js');
				require('./tests/testTime.js');
				require('./tests/testWebApp.js');
			} catch (e) {
				return cb(e);
			}

			cb();
		});
	});
};
