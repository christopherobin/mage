function MithrilGameModPlayer(mithril)
{
	this.mithril = mithril;
}


MithrilGameModPlayer.prototype.setup = function(cb)
{
	cb(null);
};


MithrilGameModPlayer.prototype.getPlayer = function(playerId, fields, cb)
{
	this.mithril.io.send('getPlayer', { playerId: playerId, fields: fields }, cb);
};