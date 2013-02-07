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
		return tome.read();
	},
	set: function (tome, diff) {
		tome.merge(diff);
	}
};

exports.init = function (tome, value) {
	function onchange() {
		value.markAsChanged();
	}

	tome.on('readable', onchange);

	return onchange;
};

exports.uninit = function (tome, value, onchange) {
	tome.removeListener('readable', onchange);
};
