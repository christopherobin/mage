// Starts all services that allow users to connect

module.exports = function (mage, cb) {
	var async = require('async');

	function exposeApps(callback) {
		async.forEachSeries(
			mage.core.app.getAppList(),
			function (app, callback) {
				app.exposeOnClientHost(callback);
			},
			callback
		);
	}

	function startClientHost(callback) {
		mage.core.msgServer.startClientHost(callback);
	}

	async.series([
		exposeApps,
		startClientHost
	],
	function (error) {
		if (error) {
			return mage.fatalError(error);
		}

		mage.setRunState('running');

		cb();
	});
};
