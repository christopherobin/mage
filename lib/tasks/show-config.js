
exports.start = function (mage, options, cb) {
	var trail = options && options.trail ? options.trail : [];

	var cfg = mage.core.config.get(trail);

	process.stdout.write(JSON.stringify(cfg, null, '  ') + '\n');

	cb(null, { shutdown: true });
};
