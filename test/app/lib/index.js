var mage = require('mage');

function mageSetup(cb) {
	mage.setup(function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
}

function mageStart(cb) {
	mage.start(cb);
}

exports.mage = mage;

// We can setup the game with this.

exports.setup = function (cb) {
	if (mage.cli) { // Backward compatibility
		mage.cli.run();
	}
	mageSetup(cb);
};

// We can start the game with this.

exports.start = function (cb) {
	mageStart(cb);
};

// We can quit the game with this.

exports.quit = function (exitCode) {
	mage.quit(exitCode);
};
