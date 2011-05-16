function MithrilGameModPlayer(mithril)
{
	this.mithril = mithril;
	this.me = { actor: this.mithril.actor.me };
}


MithrilGameModPlayer.prototype.setup = function(cb)
{
	var _this = this;

	this.mithril.io.send('player.getPlayer', { fields: ['language'] }, function(errors, response) {
		if (errors)
		{
			cb(errors);
		}
		else
		{
			_this.me.language = response.language;
			cb(null);
		}
	});
};


MithrilGameModPlayer.prototype.getPlayer = function(playerId, fields, cb)
{
	this.mithril.io.send('player.getPlayer', { playerId: playerId, fields: fields }, cb);
};
