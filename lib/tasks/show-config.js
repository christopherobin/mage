module.exports = function (trail, mage) {
	trail = trail || [];

	mage.core.logger.notice('Printing configuration at trail:', trail);

	var cfg = mage.core.config.get(trail || []);

	process.stdout.write(JSON.stringify(cfg, null, '  ') + '\n');

	mage.quit(true);
};
