function Mithril(config, sessionId)
{
	this.config = config;
	this.io = new MithrilIo(this);
	this.sessionId = sessionId;
	this.modules = [];

	// config options:
	//   config.server.host, config.server.port

	if (typeof MithrilGameModActor       !== 'undefined') this.registerModule('actor',       new MithrilGameModActor(this));
	if (typeof MithrilGameModPlayer      !== 'undefined') this.registerModule('player',      new MithrilGameModPlayer(this));
	if (typeof MithrilGameModPersistent  !== 'undefined') this.registerModule('persistent',  new MithrilGameModPersistent(this));
	if (typeof MithrilGameModGree        !== 'undefined') this.registerModule('gree',        new MithrilGameModGree(this));
	if (typeof MithrilGameModSns         !== 'undefined') this.registerModule('sns',         new MithrilGameModSns(this));
	if (typeof MithrilGameModObj         !== 'undefined') this.registerModule('obj',         new MithrilGameModObj(this));
	if (typeof MithrilGameModGc          !== 'undefined') this.registerModule('gc',          new MithrilGameModGc(this));
	if (typeof MithrilGameModMsg         !== 'undefined') this.registerModule('msg',         new MithrilGameModMsg(this));
}


Mithril.prototype.registerModule = function(name, module)
{
	this.modules.push({ name: name, module: module });
	this[name] = module;
};


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

	var _this = this;

	var tasks = [];

	for (var i=0; i < this.modules.length; i++)
	{
		if (this.modules[i].module.setup)
		{
			tasks.push(this.modules[i].module);
		}
	}

	if (tasks.length == 0) return cb();

	var next = function(error)
	{
		if (error)
			return cb(error);

		var task = tasks.shift();
		if (task)
			task.setup.call(task, next);
		else
			cb();
	};

	next();
};

