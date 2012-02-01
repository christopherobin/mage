(function (mithril) {
	var mod = mithril.data = {};


	var maps = {};

	mod.addPropertyMap = function (domainName, propertyMap) {
		// should be called when an object that contains a property map is created

		propertyMap._domainName = domainName;
		maps[domainName] = propertyMap;
	};


	mod.delPropertyMap = function (domainName) {
		// should be called when an object that contains a property map is removed

		delete maps[domainName];
	};


	mod.getPropertyMap = function (domainName) {
		return maps[domainName];
	};


	var datatypes = {};

	mod.addDataType = function (typeName, TypeClass) {
		datatypes[typeName] = TypeClass;
	};


	mod.getDataType = function (typeName) {
		return datatypes[typeName];
	};


	function parsePropertyValue(oldValue, value) {
		if (value) {
			// check if the value is of a special type

			var TypeClass = datatypes[value.__type];

			if (TypeClass) {
				// if a special datatype was already present, update its value, instead of replacing it

				if (oldValue && oldValue.__type === value.__type) {
					oldValue.setRaw(value);
					return oldValue;
				}

				var o = new TypeClass();
				o.__type = value.__type;
				o.setRaw(value);
				return o;
			}
		}

		return value;
	}


	mithril.io.on('data.set', function (path, params) {
		var domain = params[0];
		var propertyName = params[1];
		var value = params[2];

		var map = maps[domain];
		if (map) {
			map.set(propertyName, value);
		}
	}, true);


	mithril.io.on('data.del', function (path, params) {
		var domain = params[0];
		var propertyName = params[1];

		var map = maps[domain];
		if (map) {
			map.del(propertyName);
		}
	}, true);


	function PropertyMap() {
	}


	PropertyMap.prototype = new mithril.EventEmitter();


	mod.PropertyMap = PropertyMap;


	PropertyMap.prototype.initPropertyMap = function (domain, data) {
		maps[domain] = this;

		this.data = {};

		if (data) {
			for (var key in data) {
				this.data[key] = parsePropertyValue(null, data[key]);
			}
		}
	};


	PropertyMap.prototype.get = function (propertyName) {
		return this.data[propertyName];
	};


	PropertyMap.prototype.find = function (re) {
		var result = {};

		for (var key in this.data) {
			if (re.test(key)) {
				result[key] = this.data[key];
			}
		}

		return result;
	};


	PropertyMap.prototype.set = function (propertyName, value) {
		value = parsePropertyValue(this.data[propertyName], value);

		this.data[propertyName] = value;

		this.emit('set.' + propertyName, value);
		this.emit('set', propertyName, value);	// generic event, deprecated.
	};


	PropertyMap.prototype.del = function (propertyName) {
		this.emit('del.' + propertyName);

		delete this.data[propertyName];
	};


	PropertyMap.prototype.destroy = function () {
		// TODO: call this.removeAllListeners() ?
		mod.delPropertyMap(this._domainName);
	};

}(window.mithril));

