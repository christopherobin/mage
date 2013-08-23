module.exports = function (targetVersion, mage) {
	// migrate to given version

	if (!targetVersion) {
		targetVersion = mage.rootPackage.version;
	}

	mage.core.archivist.migrateToVersion(targetVersion, function (error) {
		if (error) {
			return mage.fatalError(error);
		}

		mage.quit(true);
	});
};
