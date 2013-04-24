var logger;
var dataTypes;

/**
 * To allow flexibility for testing, some objects are passed in with initialize.
 *
 * @param {Object} mageLogger A mage logger.
 * @param {Object} dTypes     The dataTypes module.
 */

exports.initialize = function (mageLogger, dTypes) {
	logger = mageLogger;
	dataTypes = dTypes;
};


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
 *   domain: { key: 'shop/3', id: 3 }
 *
 * when using createMany():
 *   domains: [{ key: 'shop/3', id: 3}, { key: 'shop/5', id: 5}]
 *
 * property: 'name/language/tag' where language may be 'ALL' and the final "/tag" is optional
 *
 * value format in the k/v store:
 *
 *   key: domain/data/propertykey
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


function LivePropertyMap(state, domain, options) {
	this.state = state;
	this.domain = domain;
	this.options = options || {};
	this.data = {};				// list of all previously loaded full propertyKeys in this property map
	this.propertyList = null;	// list of _all_ (non full) propertyKeys in this property map (even the ones not loaded)

	this._keyPropertyList = domain.key + '/datakeys';
	this._keyPrefix = domain.key + '/data/';
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


function readDomain(state, map, cb) {
	// read the property list from the domain

	state.datasources.kv.getOne(map._keyPropertyList, false, null, function (error, value) {
		if (error) {
			return cb(error);
		}

		if (value) {
			// parse the list

			if (typeof value !== 'string') {
				return state.error(null, 'Datakeys is not a string: ' + JSON.stringify(value), cb);
			}

			map.propertyList = value.split('|');
		} else {
			map.propertyList = [];
		}

		cb();
	});
}


function readDomains(state, maps, options, cb) {
	// read all property lists from the domains

	var keys = [];
	var keyToMap = {};

	for (var domainId in maps) {
		var map = maps[domainId];

		keys.push(map._keyPropertyList);
		keyToMap[map._keyPropertyList] = map;

		map.propertyList = [];	// for the cases where there is no propertylist and nothing is returned
	}

	// if options.mapsAreOptional is truthy, they are not required to exist

	var required = !options.mapsAreOptional;

	state.datasources.kv.getMany(keys, required, null, function (error, values) {
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


LivePropertyMap.create = function (state, domain, options, cb) {
	if (!domain) {
		return state.error(null, 'Trying to create a LivePropertyMap without a domain.', cb);
	}

	// creates a LivePropertyMap instance

	var map = new LivePropertyMap(state, domain, options);

	// read the list of available properties for this domain

	readDomain(state, map, function (error) {
		if (error) {
			return cb(error);
		}

		// load the requested properties

		map.load(map.options, function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, map);
		});
	});
};


LivePropertyMap.createMany = function (state, domains, options, cb) {
	if (!domains) {
		return state.error(null, 'Trying to create a group of LivePropertyMaps without a domain specification.', cb);
	}

	// create a live property map for each domain

	var maps = {};	// { domainKey: livePropertyMap }, which is the response object

	// per-domain pre-processing

	var len = domains.length;

	if (len === 0) {
		return cb(null, maps);	// empty list. odd, but valid.
	}

	for (var i = 0; i < len; i++) {
		var domain = domains[i];

		// create the live property map and insert it into the maps lookup list

		var map = new LivePropertyMap(state, domain, options);

		maps[domain.id] = map;
	}

	// make sure every propertymap becomes aware of its propertylist

	readDomains(state, maps, options, function (error) {
		if (error) {
			return cb(error);
		}

		// make sure we preload all required properties

		var propertyKeys = [];
		var propertyKeyToMap = {};

		for (var domainId in maps) {
			var map = maps[domainId];

			var preloadKeys = map._getPreloadKeys(map.options);

			if (preloadKeys === false) {
				// error situation! most likely missing keys

				return state.error(null, 'Failed to load properties for LivePropertyMap ' + map.domain.key + ', most likely due to missing required properties.', cb);
			}

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

		state.datasources.kv.getMany(propertyKeys, true, null, function (error, values) {
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


LivePropertyMap.prototype._getPreloadKeys = function (options) {
	// returns false on error

	options = options || {};

	var keys = [];
	var loadAll = options.loadAll;
	var load = options.load;
	var optional = options.optional;
	var language = options.language;
	var tags = options.tags;
	var remainingPropNames = {};
	var i, len, name;

	// if nothing is being requested, we return the empty array

	if (!loadAll && !Array.isArray(load) && !optional) {
		return keys;
	}

	if (load) {
		for (i = 0, len = load.length; i < len; i++) {
			remainingPropNames[load[i]] = true;
		}
	}

	if (optional) {
		for (i = 0, len = optional.length; i < len; i++) {
			remainingPropNames[optional[i]] = true;
		}
	}

	for (i = 0, len = this.propertyList.length; i < len; i++) {
		var key = this._keyPrefix + this.propertyList[i];
		var parsed = parseFullPropertyKey(key);

		if (!parsed) {
			// unable to parse
			continue;
		}

		if (key in this.data) {
			// skip keys that have already been loaded
			remainingPropNames[parsed.name] = false;
			continue;
		}

		// this key may be in the wrong language

		if (language && parsed.language && parsed.language !== language) {
			continue;
		}

		// this key may not have the right tags

		if (tags && parsed.tag && tags.indexOf(parsed.tag) === -1) {
			continue;
		}

		// we may not have asked for this property

		if (!loadAll) {
			var requested = false;

			if (load && load.indexOf(parsed.name) !== -1) {
				requested = true;
			} else if (optional && optional.indexOf(parsed.name) !== -1) {
				requested = true;
			}

			if (!requested) {
				continue;
			}
		}

		// we're going to load this key

		keys.push(key);
		remainingPropNames[parsed.name] = false;
	}

	// make sure all props we needed to load are being loaded

	var failed;

	for (name in remainingPropNames) {
		// if a required property name is not being loaded, this is an error situation
		// unless the property was optional

		if (remainingPropNames[name] && (!optional || optional.indexOf(name) === -1)) {
			if (failed) {
				failed.push(name);
			} else {
				failed = [name];
			}
		}
	}

	if (failed) {
		logger.error('Failed to load properties:', failed, 'on prefix', this._keyPrefix);

		return false;
	}

	// return the loaded keys

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


LivePropertyMap.prototype.exists = function (propertyName, language, tag) {
	propertyName = '' + propertyName;

	for (var i = 0, len = this.propertyList.length; i < len; i++) {
		// parse the key

		var parsed = parseFullPropertyKey(this._keyPrefix + this.propertyList[i]);
		if (!parsed || (propertyName !== parsed.name) || (language && parsed.language && parsed.language !== language) || (tag && parsed.tag && tag === parsed.tag)) {
			continue;
		}

		return true;
	}

	return false;
};


function parseObject(obj) {
	if (obj.__type) {
		obj = dataTypes.createValue(obj.__type, obj);
	} else {
		for (var key in obj) {
			var value = obj[key];

			if (value && typeof value === 'object') {
				obj[key] = parseObject(value);
			}
		}
	}

	return obj;
}


function parseValue(jsonData) {
	try {
		var value = JSON.parse(jsonData);

		if (value && typeof value === 'object') {
			value = parseObject(value);
		}

		return value;
	} catch (e) {
		logger.error('LivePropertyMap parse error');
	}

	return null;
}


LivePropertyMap.prototype.load = function (options, cb) {
	// does not return anything, but loads the keys just like create(state, domain, { load: ['my', 'keys'] }, cb) does
	// this allows you to extend the loaded properties on a LivePropertyMap.

	var keys = this._getPreloadKeys(options);

	if (keys === false) {
		// error situation! most likely missing keys

		return this.state.error(null, 'Failed to load properties for LivePropertyMap ' + this.domain.key + ', most likely due to missing required properties.', cb);
	}

	var data = this.data;

	// load remaining keys

	if (keys.length === 0) {
		// nothing to load

		return cb();
	}

	// load keys

	this.state.datasources.kv.getMany(keys, true, null, function (error, values) {
		if (error) {
			return cb(error);
		}

		for (var key in values) {
			data[key] = values[key];
		}

		cb();
	});
};


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


LivePropertyMap.prototype.getAllExistingProperties = function () {
	// returns a list of properties that exist (but may not have been loaded)
	// does not return values

	var result = [];

	for (var i = 0, len = this.propertyList.length; i < len; i++) {
		// parse the key

		result.push(parseFullPropertyKey(this._keyPrefix + this.propertyList[i]));
	}

	return result;
};


LivePropertyMap.prototype.countAllExistingProperties = function () {
	return this.propertyList.length;
};


LivePropertyMap.prototype.toJSON = function () {
	logger.error('Trying to stringify a LivePropertyMap');
};


LivePropertyMap.prototype.stringify = function (language, tags) {
	var output = [];

	for (var key in this.data) {
		var parsed = parseFullPropertyKey(key);

		if (parsed && (!parsed.language || parsed.language === language) && (!parsed.tag || tags.indexOf(parsed.tag) !== -1)) {
			output.push('"' + parsed.name.replace(/"/g, '\\"') + '":' + this.data[key]);
		}
	}

	return '{' + output.join(',') + '}';
};


LivePropertyMap.prototype.emitEvent = function (path, evt, language) {
	var events = this.domain.events;

	if (events) {
		var actorIds = events.actorIds;
		if (actorIds) {
			this.state.emitToActors(actorIds, path, evt, language);
		}
	}
};


LivePropertyMap.prototype._write = function (key, value, ttl) {
	// we know that the transactional memcached interface does not require callbacks on mutations (set, del)

	var kv = this.state.datasources.kv;

	var fullKey = this._keyPrefix + key;

	kv.set(fullKey, value, ttl);

	if (this.propertyList.indexOf(key) === -1) {
		this.propertyList.push(key);

		kv.set(this._keyPropertyList, this.propertyList.join('|'));
	}

	this.data[fullKey] = value;
};


LivePropertyMap.prototype._delete = function (key) {
	// we know that the transactional memcached interface does not require callbacks on mutations (set, del)

	var kv = this.state.datasources.kv;

	var fullKey = this._keyPrefix + key;

	kv.del(fullKey);

	var index = this.propertyList.indexOf(key);
	if (index !== -1) {
		this.propertyList.splice(index, 1);

		if (this.propertyList.length > 0) {
			kv.set(this._keyPropertyList, this.propertyList.join('|'));
		} else {
			kv.del(this._keyPropertyList);
		}
	}

	delete this.data[fullKey];
};


LivePropertyMap.prototype.set = function (propertyName, value, language, tag, ttl) {
	if (value === undefined) {
		logger.error('LivePropertyMap cannot write undefined (' + propertyName + ')');
		return;
	}

	var key = generatePropertyKey(propertyName, language, tag);

	this._write(key, JSON.stringify(value), ttl);

	this.emitEvent('data.set', [this.domain.key, propertyName, value], language);
};


LivePropertyMap.prototype.del = function (propertyName, language, tag) {
	var key = generatePropertyKey(propertyName, language, tag);

	this._delete(key);

	this.emitEvent('data.del', [this.domain.key, propertyName], language);
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
	this.data = {};
};


LivePropertyMap.prototype.importFromStaticPropertyMap = function (srcMap, language, tags, fnFilter) {
	var map = srcMap.getAllFull(language, tags, fnFilter);

	for (var propertyName in map) {
		var property = map[propertyName];

		for (var i = 0, len = property.length; i < len; i++) {
			var obj = property[i];

			var key = generatePropertyKey(propertyName, obj.language, obj.tag);

			this._write(key, JSON.stringify(obj.value));
		}
	}
};
