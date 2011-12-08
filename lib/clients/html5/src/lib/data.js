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


	function parsePropertyValue(obj) {
		if (obj) {
			var TypeClass = datatypes[obj.__type];

			if (TypeClass) {
				var o = new TypeClass();
				o.setRaw(obj);
				return o;
			}
		}

		return obj;
	};


	mithril.io.on('data.set', function (path, domain, propertyName, value) {
		var map = maps[domain];
		if (map) {
			map.set(propertyName, value);
		}
	}, true);

	mithril.io.on('data.del', function (path, domain, propertyName) {
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
				this.data[key] = parsePropertyValue(data[key]);
			}
		}
	};


	PropertyMap.prototype.get = function (propertyName) {
		return this.data[propertyName];
	};


	PropertyMap.prototype.set = function (propertyName, value) {
		value = parsePropertyValue(value);

		this.data[propertyName] = value;

		this.emit('set', propertyName, value);
	};


	PropertyMap.prototype.del = function (propertyName) {
		this.emit('del', propertyName);

		delete this.data[propertyName];
	};


	PropertyMap.prototype.destroy = function () {
		mod.delPropertyMap(this._domainName);
	};

}(window.mithril));

