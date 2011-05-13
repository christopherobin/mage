function Mithril(config, sessionId)
{
	this.config = config;
	this.io = new MithrilIo(this);
	this.sessionId = sessionId;

	// config options:
	//   config.server.host, config.server.port

	if (typeof MithrilGameModActor  != 'undefined') this.actor  = new MithrilGameModActor(this);
	if (typeof MithrilGameModPlayer != 'undefined') this.player = new MithrilGameModPlayer(this);
//	if (typeof MithrilGameModSns    != 'undefined') this.sns    = new MithrilGameModSns(this);
	if (typeof MithrilGameModObj    != 'undefined') this.obj    = new MithrilGameModObj(this);
	if (typeof MithrilGameModGc     != 'undefined') this.gc     = new MithrilGameModGc(this);
}


Mithril.prototype.start = function(cb)
{
	var _this = this;

	this.io.start(function(error) {
		if (error)
		{
			cb(error);
		}
		else
		{
			_this.setupModules(cb);
		}
	});
};


Mithril.prototype.setupModules = function(cb)
{
	var done = 0;
	var modules = [];

	if (this.actor)  modules.push(this.actor);
	if (this.player) modules.push(this.player);
	if (this.sns)    modules.push(this.sns);
	if (this.obj)    modules.push(this.obj);
	if (this.gc)     modules.push(this.gc);

	var _this = this;

	for (var i=0; i < modules.length; i++)
	{
		modules[i].setup(function(error) {
			if (error)
			{
				if (cb) { cb(error); cb = null; }
			}
			else
			{
				if (++done == modules.length)
				{
					if (cb) { cb(null); cb = null; }
				}
			}
		});
	}
};

