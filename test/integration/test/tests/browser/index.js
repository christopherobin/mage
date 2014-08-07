module.exports = function (done) {
	var mage = window.mage = require('mage');

	mage.httpServer.cmdMode = 'free';

	mage.setup(function (error) {
		assert.ifError(error);

		require('testEventManager');
		require('testLoader');
		require('testArchivist');
		require('testIdent');
		require('testSession');

		done();
	});
};
