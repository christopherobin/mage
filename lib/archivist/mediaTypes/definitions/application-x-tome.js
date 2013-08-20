var Tome = require('tomes').Tome;


exports.mediaType = 'application/x-tome';
exports.fileExt = 'tome';


exports.detector = function (data) {
	return Tome.isTome(data) ? 1 : 0;
};


exports.encoders = {
	'utf8-live': function (data) { return Tome.conjure(JSON.parse(data)); },
	'live-utf8': function (tome, options) { return JSON.stringify(tome, null, options.pretty ? true : false); }
};

exports.diff = {
	get: function (tome) {
		var diff, diffs = [];

		while ((diff = tome.read())) {
			diffs.push(diff);
		}

		return diffs;
	},
	set: function (tome, diffs) {
		tome.merge(diffs);
	}
};

exports.init = function (tome, value) {
	// init returns the uninitialize function

	function onchange() {
		value.set(null, tome, 'live');
	}

	tome.on('readable', onchange);

	return function () {
		tome.removeListener('readable', onchange);
	};
};
