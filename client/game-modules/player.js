function MithrilGameModPlayer(mithril)
{
	this.mithril = mithril;
	this.me = {};
}


MithrilGameModPlayer.prototype.setup = function(cb)
{
	var _this = this;

	this.me.actor = this.mithril.actor.me;

	this.mithril.io.send('player.sync', {}, function(errors, response) {
		if (errors) return cb(errors);

		_this.me = response.me;

		cb();
	});
};


MithrilGameModPlayer.prototype.myLanguage = function()
{
	return this.me.language || 'JA';
};


MithrilGameModPlayer.prototype.getPlayer = function(playerId, fields, cb)
{
	this.mithril.io.send('player.getPlayer', { playerId: playerId, fields: fields }, cb);
};
