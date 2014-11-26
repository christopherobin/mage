var fs = require('fs');

module.exports = function checkMagic(mage) {
	var CHECK_PATH = './check.txt';

	function removeCheck() {
		if (fs.existsSync(CHECK_PATH)) {
			fs.unlinkSync(CHECK_PATH);
		}
	}

	var shouldCheck = mage.core.config.get('checkMagic');

	if (shouldCheck) {
		fs.writeFileSync(CHECK_PATH, 'production');
		mage.once('shutdown', removeCheck);
	} else {
		removeCheck();
	}
};
