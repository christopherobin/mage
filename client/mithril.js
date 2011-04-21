function Mithril(config, sessionId)
{
	this.config = config;
	this.io = new MithrilIo(this);
	this.sessionId = sessionId;

	// config options:
	//   config.server.host, config.server.port

	if (typeof MithrilGameModActor  != 'undefined') this.actor  = new MithrilGameModActor(this);
	if (typeof MithrilGameModPlayer != 'undefined') this.player = new MithrilGameModPlayer(this);
	if (typeof MithrilGameModSns    != 'undefined') this.sns    = new MithrilGameModSns(this);
	if (typeof MithrilGameModObj    != 'undefined') this.obj    = new MithrilGameModObj(this);
	if (typeof MithrilGameModGc     != 'undefined') this.gc     = new MithrilGameModGc(this);
}


Mithril.prototype.start = function()
{
	if (this.actor)  this.actor.setup();
	if (this.player) this.player.setup();
	if (this.sns)    this.sns.setup();
	if (this.obj)    this.obj.setup();
	if (this.gc)     this.gc.setup();

	this.io.start();
};


/*
// CONCEPT:

mithril.sns.getMyFriends(cb);

mithril.obj.loadAll(cb);
	this.cache.collection.isFullyLoaded = true;
	this.cache.collection['deck'] = data.deck;
	this.cache.objects.isFullyLoaded = true;
	this.cache.objects[..] = data....;

mithril.obj.getCollections('deck', cb);
	if ('deck' in this.cache.collection) return this.cache['deck'];
	return this.cache['deck'] = data;

mithril.obj.getCollections('cardlist', cb);

for (collections)
	if (myObj.id in collection) myObj = collection[myObj.id];


Cards
	this.getDeck = function(cb)
	{
		mithril.obj.getCollections('deck', cb);
	}
*/

