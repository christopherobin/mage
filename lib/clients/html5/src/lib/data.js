(function (mage) {
	var mod = mage.data = {};


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


	function parsePropertyObject(oldValue, obj) {
		if (obj.__type) {
			var TypeClass = datatypes[obj.__type];

			if (TypeClass) {
				// if a special datatype was already present, update its value, instead of replacing it

				var o;

				if (oldValue && oldValue.__type === obj.__type) {
					o = oldValue;
				} else {
					o = new TypeClass();
					o.__type = obj.__type;
				}

				o.setRaw(obj);
				return o;
			} else {
				console.warn('Unknown data type:', obj.__type);
			}
		} else {
			for (var key in obj) {
				var value = obj[key];

				if (value && typeof value === 'object') {
					obj[key] = parsePropertyObject(oldValue ? oldValue[key] : null, value);
				}
			}
		}

		return obj;
	}


	function parsePropertyValue(oldValue, value) {
		if (value && typeof value === 'object') {
			value = parsePropertyObject(oldValue, value);
		}

		return value;
	}


	mage.io.on('data.set', function (path, params) {
		var domain = params[0];
		var propertyName = params[1];
		var value = params[2];

		var map = maps[domain];
		if (map) {
			map.set(propertyName, value);
		}
	}, true);


	mage.io.on('data.del', function (path, params) {
		var domain = params[0];
		var propertyName = params[1];

		var map = maps[domain];
		if (map) {
			map.del(propertyName);
		}
	}, true);


	function PropertyMap() {
	}


	PropertyMap.prototype = new mage.EventEmitter();


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


	PropertyMap.prototype.getAll = function () {
		return this.data;
	};


	PropertyMap.prototype.count = function () {
		var count = 0;

		for (var key in this.data) {
			count += 1;
		}

		return count;
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
		var previousValue = this.data[propertyName];

		value = parsePropertyValue(previousValue, value);

		this.data[propertyName] = value;

		this.emit('set.' + propertyName, value, previousValue);
		this.emit('set', propertyName, value, previousValue);	// generic event, deprecated.

		if (previousValue === undefined) {
			this.emit('add', propertyName, value);
		}
	};


	PropertyMap.prototype.del = function (propertyName) {
		var previousValue = this.data[propertyName];

		this.emit('del.' + propertyName, previousValue);
		this.emit('del', propertyName, previousValue);

		delete this.data[propertyName];
	};


	PropertyMap.prototype.destroy = function () {
		// TODO: call this.removeAllListeners() ?
		mod.delPropertyMap(this._domainName);
	};

}(window.mage));

