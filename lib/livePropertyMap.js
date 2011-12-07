var mithril = require('./mithril'),
    async = require('async');

/* variables:
 *
 *
 * domain:
 *   A string that defines the logical domain of the property map.
 *   May contain slashes, but not the string "/data/".
 *   eg: "shop/3", "actor/5"
 *
 * property name:
 *   A string that describes the property.
 *   May not contain slashes or pipes.
 *   eg: "name"
 *
 * language:
 *   describes the language used, only A-Za-z allowed. Upper case encouraged.
 *   in API calls, may be null to mean "not language specific", which translates into the stored string "ALL"
 *   eg: "EN"
 *
 * full property key:
 *   domain/data/propertyKey
 *
 * property key:
 *   propertyName/language  or:
 *   propertyName/language/tag
 *
 *
 * storage in key/value system
 *
 * when using create():
 * config: {
 *   domain: 'shop/3'
 * }
 *
 * when using createMany():
 * config: {
 *   domains: { 3: 'shop/3', 5: 'shop/5' }
 * }
 *
 * property: 'name/language/tag' where language may be 'ALL' and the final "/tag" is optional
 *
 * value format in the k/v store:
 *
 *   key: domain/data/property
 *   value JSON encoded value
 *
 * value list format in the k/v store:
 *
 *   key:            domain/datakeys
 *   value (string): propertykey|propertykey|propertykey|propertykey,...
 *
 * expiration time (like with persistent data) can now be supported out of the box when setting a value
 *
 * example options (user driven): {
 *   loadAll: true (loads all properties)
 *   load: ['propertyName', 'propertyName'] (loads given properties)
 *   language: 'EN' (which will load languages 'ALL' and 'EN')
 * }
 */


// TODO: implement a length-getter and perhaps a keys() function, so we can iterate through the properties?


function LivePropertyMap(state, config, options) {
	// config:

	this.state = state;
	this.config = config;
	this.options = options || {};
	this.data = {};				// list of all previously loaded full propertyKeys in this property map
	this.propertyList = null;	// list of _all_ (non full) propertyKeys in this property map (even the ones not loaded)

	this._keyPropertyList = config.domain.key + '/datakeys';
	this._keyPrefix = config.domain.key + '/data/';
}


exports.LivePropertyMap = LivePropertyMap;


function generatePropertyKey(propertyName, language, tag) {
	var key = propertyName + '/' + (language || 'ALL');

	if (tag) {
		key += '/' + tag;
	}

	return key;
}


function parseFullPropertyKey(key) {
	key = key.split('/data/');
	if (key.length === 2) {
		key = key[1].split('/');

		return {
			name: key[0],
			language: key[1] === 'ALL' ? null : key[1],
			tag: key[2] || null
		};
	}

	return null;
}


function fullKeyToPropertyName(key) {
	var m = key.match(/\/data\/(.+?)\//);
	if (m && m[1]) {
		return m[1];
	}

	return null;
}


function readDomain(state, map, cb) {
	state.datasources.kv.getOne(map._keyPropertyList, false, null, function (error, value) {
		if (error) {
			return cb(error);
		}

		if (value) {
			// parse the list

			map.propertyList = value.split('|');
		} else {
			map.propertyList = [];
		}

		cb();
	});
}


function readDomains(state, maps, cb) {
	// read all property lists from the domains

	var keys = [];
	var keyToMap = {};

	for (var domainId in maps) {
		var map = maps[domainId];

		keys.push(map._keyPropertyList);
		keyToMap[map._keyPropertyList] = map;

		map.propertyList = [];	// for the cases where there is no propertylist and nothing is returned
	}

	state.datasources.kv.getMany(keys, null, function (error, values) {
		if (error) {
			return cb(error);
		}

		for (var key in values) {
			var map = keyToMap[key];
			if (!map) {
				continue;
			}

			var value = values[key];

			// create the propertyList lookup

			if (value) {
				// parse the list

				map.propertyList = value.split('|');
			}
		}

		cb();
	});
}


LivePropertyMap.create = function (state, config, options, cb) {
	// creates a LivePropertyMap instance

	var map = new LivePropertyMap(state, config, options);

	// read the list of available properties for this domain

	readDomain(state, map, function (error) {
		if (error) {
			return cb(error);
		}

		// load the requested properties

		var keys = map._getPreloadKeys();

		if (keys.length === 0) {
			// nothing to load

			return cb(null, map);
		}

		// load keys

		state.datasources.kv.getMany(keys, null, function (error, values) {
			if (error) {
				return cb(error);
			}

			for (var key in values) {
				map.data[key] = values[key];
			}
			cb(null, map);
		});
	});
};


LivePropertyMap.createMany = function (state, config, options, cb) {
	// create a live property map for each domain

	var maps = {};	// { domainKey: livePropertyMap }, which is the response object

	// per-domain pre-processing

	var domains = config.domains;

	for (var i = 0, len = domains.length; i < len; i++) {
		var domain = domains[i];

		// create a new config for each domain

		var cfg = { domain: domain };

		for (var key in config) {
			if (key !== 'domains') {
				cfg[key] = config[key];
			}
		}

		// create the live property map and insert it into the maps lookup list

		var map = new LivePropertyMap(state, cfg, options);

		maps[domain.id] = map;
	}

	// make sure every propertymap becomes aware of its propertylist

	readDomains(state, maps, function (error) {
		if (error) {
			return cb(error);
		}

		// make sure we preload all required properties

		var propertyKeys = [];
		var propertyKeyToMap = {};

		for (var domainId in maps) {
			var map = maps[domainId];

			var preloadKeys = map._getPreloadKeys();

			for (var i = 0, len = preloadKeys.length; i < len; i++) {
				var preloadKey = preloadKeys[i];

				propertyKeys.push(preloadKey);
				propertyKeyToMap[preloadKey] = map;
			}
		}

		// if there is nothing to load, return immediately

		if (propertyKeys.length === 0) {
			return cb(null, maps);
		}

		// load keys

		state.datasources.kv.getMany(propertyKeys, null, function (error, values) {
			if (error) {
				return cb(error);
			}

			for (var key in values) {
				var map = propertyKeyToMap[key];
				if (map) {
					map.data[key] = values[key];
				}
			}

			cb(null, maps);
		});
	});
};


LivePropertyMap.prototype._getPreloadKeys = function () {
	var options = this.options;
	var domain = this.config.domain;

	var keys, i, len;

	if (Array.isArray(options.load)) {
		// load everything requested

		// for all mentioned properties in options.load, check if exists in this.propertyList and if so, load it

		keys = [];
		var load = options.load;
		var language = options.language;
		var tags = options.tags;

		len = this.propertyList.length;

		for (i = 0; i < len; i++) {
			var key = this._keyPrefix + this.propertyList[i];
			var parsed = parseFullPropertyKey(key);

			if (parsed && load.indexOf(parsed.name) !== -1 && (!language || !parsed.language || parsed.language === language) && (!tags || !parsed.tag || tags.indexOf(parsed.tag) !== -1)) {
				keys.push(key);
			}
		}
	} else if (options.loadAll) {
		// load everything

		len = this.propertyList.length;

		keys = new Array(len);

		for (i = 0; i < len; i++) {
			keys[i] = this._keyPrefix + this.propertyList[i];
		}
	} else {
		keys = [];
	}

	return keys;
};


LivePropertyMap.prototype.getRaw = function (propertyName, language, tag) {
	var key;

	if (language) {
		key = this._keyPrefix + generatePropertyKey(propertyName, language, tag);
		if (key in this.data) {
			return this.data[key];
		}
	}

	key = this._keyPrefix + generatePropertyKey(propertyName, null, tag);
	if (key in this.data) {
		return this.data[key];
	}

	return null;

};


LivePropertyMap.prototype.has = function (propertyName, language, tag) {
	var rawValue = this.getRaw(propertyName, language, tag);
	return rawValue !== null;
};


function parseValue(jsonData) {
	try {
		var value = JSON.parse(jsonData);

		if (value !== null && typeof value === 'object') {
			var specialType = value.__type;
			if (specialType) {
				value = mithril.core.datatypes.createValue(specialType, value);
			}
		}

		return value;
	} catch (e) {
		mithril.core.logger.error('LivePropertyMap parse error');
	}

	return null;
}


LivePropertyMap.prototype.get = function (propertyName, language, tag) {
	var rawValue = this.getRaw(propertyName, language, tag);

	if (rawValue !== null) {
		return parseValue(rawValue);
	}

	return null;
};


LivePropertyMap.prototype.getAll = function (language, tag) {
	var result = {};

	for (var key in this.data) {
		var parsed = parseFullPropertyKey(key);

		if (parsed && (!language || !parsed.language || parsed.language === language) && (!tag || !parsed.tag || parsed.tag === tag)) {
			result[parsed.name] = parseValue(this.data[key]);
		}
	}

	return result;
};


LivePropertyMap.prototype.toJSON = function () {
	mithril.core.logger.error('Trying to stringify a LivePropertyMap');
};


LivePropertyMap.prototype.stringify = function (language, tag) {
	var output = [];

	for (var key in this.data) {
		var parsed = parseFullPropertyKey(key);

		if (parsed && (!language || !parsed.language || parsed.language === language) && (!tag || !parsed.tag || parsed.tag === tag)) {
			output.push('"' + parsed.name.replace(/"/g, '\\"') + '":' + this.data[key]);
		}
	}

	return '{' + output.join(',') + '}';
};

LivePropertyMap.prototype.emit = function (language, operation) {
	var domain = this.config.domain;

	var events = domain.events;

	if (events && events.actorIds && events.path) {
		var path = events.path.replace('$type', operation.type).replace('$domainId', domain.id).replace('$propertyName', operation.property);

		var filter = { actorIds: events.actorIds };

		if (language) {
			filter.language = language;
		}

		if (events.identifier) {
			operation[events.identifier] = domain.id;
		}

		state.emitToMany(filter, path, operation);
	}
};


LivePropertyMap.prototype._write = function (key, value, ttl) {
	// we know that the transactional memcached interface does not require callbacks on mutations (set, del)

	var kv = this.state.datasources.kv;

	kv.set(this._keyPrefix + key, value, ttl);

	if (this.propertyList.indexOf(key) === -1) {
		this.propertyList.push(key);

		kv.set(this._keyPropertyList, this.propertyList.join('|'));
	}
};


LivePropertyMap.prototype._delete = function (key) {
	// we know that the transactional memcached interface does not require callbacks on mutations (set, del)

	var kv = this.state.datasources.kv;

	kv.del(this._keyPrefix + key);

	var index = this.propertyList.indexOf(key);
	if (index !== -1) {
		this.propertyList.splice(index, 1);

		if (this.propertyList.length > 0) {
			kv.set(this._keyPropertyList, this.propertyList.join('|'));
		} else {
			kv.del(this._keyPropertyList);
		}
	}
};


LivePropertyMap.prototype.set = function (propertyName, value, language, tag, ttl) {
	var key = generatePropertyKey(propertyName, language, tag);

	this._write(key, JSON.stringify(value), ttl);

	this.emit(language, { type: 'set', property: propertyName, value: value });
};


LivePropertyMap.prototype.del = function (propertyName, language, tag) {
	var key = generatePropertyKey(propertyName, language, tag);

	this._delete(key);

	this.emit(language, { type: 'del', property: propertyName });
};


LivePropertyMap.prototype.destroy = function () {
	// does not emit events
	// deletes:
	// - all properties that are mentioned in the property list
	// - the property list

	var kv = this.state.datasources.kv;

	for (var i = 0, len = this.propertyList.length; i < len; i++) {
		kv.del(this._keyPrefix + this.propertyList[i]);
	}

	kv.del(this._keyPropertyList);

	this.propertyList = [];
};


LivePropertyMap.prototype.importFromStaticPropertyMap = function (srcMap, language, tags, fnFilter) {
	var map = srcMap.getAllFull(language, tags, fnFilter);

	for (var propertyName in map) {
		var property = map[propertyName];

		for (var i = 0, len = property.length; i < len; i++) {
			var obj = property[i];

			var key = generatePropertyKey(propertyName, obj.language, obj.tag);

			this._write(key, obj.value);
		}
	}
};

