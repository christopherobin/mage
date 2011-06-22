function MithrilGameModPersistent(mithril)
{
	this.mithril = mithril;
	this.data = null;
}


MithrilGameModPersistent.prototype.setup = function(cb)
{
	var _this = this;

	this.mithril.io.send('persistent.sync', {}, function(errors, data) {
		if (errors) return cb(errors);

		_this.data = data;
		cb(null, data);
	});
};


MithrilGameModPersistent.prototype.getAll = function(cb)
{
	var _this = this;

	this.mithril.io.send('persistent.getAll', {}, function(errors, data) {
		if (errors) return cb(errors);

		_this.data = data;	// also synchronizes the data
		cb(null, data);
	});
};


MithrilGameModPersistent.prototype.get = function(properties, removeAfterGet, cb)
{
	var _this = this;

	if (!(properties instanceof Array)) properties = [properties];

	this.mithril.io.send('persistent.get', { properties: properties, removeAfterGet: !!removeAfterGet }, function(errors, data) {
		if (errors) return cb(errors);

		for (var key in data)
		{
			if (removeAfterGet)
			{
				delete _this.data[key];
			}
			else
				_this.data[key] = data[key];
		}

		cb(null, data);
	});
};


MithrilGameModPersistent.prototype.set = function(data, expirationTime, cb)
{
	var _this = this;

	this.mithril.io.send('persistent.set', { properties: data, expirationTime: expirationTime }, function(errors) {
		if (errors) { if (cb) cb(errors); return; }

		for (var key in data)
		{
			_this.data[key] = data[key];
		}

		if (cb) cb();
	});
};


MithrilGameModPersistent.prototype.del = function(properties, cb)
{
	var _this = this;

	this.mithril.io.send('persistent.del', { properties: properties }, function(errors) {
		if (errors) { if (cb) cb(errors); return; }

		var len = properties.length;
		for (var i=0; i < len; i++)
		{
			delete _this.data[properties[i]];
		}

		if (cb) cb();
	});
};


MithrilGameModPersistent.prototype.clear = function(cb)
{
	var _this = this;

	this.mithril.io.send('persistent.clear', {}, function(errors) {
		if (errors) { if (cb) cb(errors); return; }

		_this.data = {};

		if (cb) cb();
	});
};

