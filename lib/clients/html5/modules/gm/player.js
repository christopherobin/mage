function MithrilGameModPlayerGm(mithril) {
	this.mithril = mithril;
}

MithrilGameModPlayerGm.prototype.getPlayers = function (cb) {
	this.mithril.io.send('player.getPlayers', {}, function (errors, result) {
		if (errors) {
			return cb(errors);
		}

		cb(result);
	});
}

MithrilGameModPlayerGm.prototype.editPlayer = function (params, cb) {
	this.mithril.io.send('player.editPlayer', params, function (errors, result) {
		if (errors)
			return cb(errors);

		cb(result);
	});
}

MithrilGameModPlayerGm.prototype.deletePlayer = function (params, cb) {
	this.mithril.io.send('player.deletePlayer', params, function (errors, result) {
		if (errors)
			return cb(errors);

		cb(null, result);
	});
}

MithrilGameModPlayerGm.prototype.getPlayerData = function (params, cb) {
	this.mithril.io.send('player.getPlayerData', params, function (errors, result) {
		if (errors)
			return cb(errors);

		cb(null, result);
	});
}

