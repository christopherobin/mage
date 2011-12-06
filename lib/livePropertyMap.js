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
	this.propertyList = null;	// list of _all_ full propertyKeys in this property map (even the ones not loaded)
}


exports.LivePropertyMap = LivePropertyMap;


function generateFullPropertyKey(domain, propertyName, language, tag) {
	var key = propertyName + '/' + (language || 'ALL');

	if (tag) {
		key += '/' + tag;
	}

	return domain + '/data/' + key;
}


function parseFullPropertyKey(key) {
	key = key.split('/data/');
	if (key.length === 2) {
		key = key[1].split('/');

		var propertyName = key[0];

		var language = key[1];
		if (language === 'ALL') {
			language = null;
		}

		var tag = key[2] || null;

		return {
			name: propertyName,
			language: language,
			tag: tag
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


function generateFullPropertyKeys(domains, propertyNames, language, tag) {
	if (!Array.isArray(domains)) {
		domains = [domains];
	}

	var languages = ['ALL'];

	if (language) {
		if (Array.isArray(language)) {
			languages = languages.concat(language);
		} else {
			languages.push(language);
		}
	}

	var tags;
	if (tag) {
		if (Array.isArray(tag)) {
			tags = tag;
		} else {
			tags = [tag];
		}
	}

	var keys = [], domain, propertyName;

	for (var d = 0, dlen = domains.length; d < dlen; d++) {
		// for each domain

		domain = domains[d];

		for (var i = 0, len = propertyNames.length; i < len; i++) {
			// and each property name

			propertyName = propertyNames[i];

			for (var j = 0, jlen = languages.length; j < jlen; j++) {
				// and each language

				language = languages[j];

				if (tags) {
					for (var k = 0, klen = tags.length; k < klen; k++) {
						// and each tag

						keys.push(generateFullPropertyKey(domain, propertyName, language, tags[k]));
					}
				} else {
					keys.push(generateFullPropertyKey(domain, propertyName, language));
				}
			}
		}
	}

	return keys;
}


function readDomain(state, map, cb) {
	var kv = state.datasources.kv;
	var domain = map.config.domain;

	if (!domain) {
		return state.error(null, 'Cannot read domain information without a domain configuration.', cb);
	}

	var key = domain + '/datakeys';

	kv.getOne(key, false, null, function (error, value) {
		if (error) {
			return cb(error);
		}

		if (value) {
			// parse the list

			value = value.split('|');

			var len = value.length;
			var prefix = domain + '/data/';

			map.propertyList = new Array(len);

			for (var i = 0; i < len; i++) {
				map.propertyList[i] = prefix + value[i];
			}
		} else {
			// write the property list into the property map's data lookup

			map.propertyList = [];
		}

		cb();
	});
}


function readDomains(state, maps, cb) {
	// read all datakeys lists from the domains

	var kv = state.datasources.kv;
	var keys = [];
	var keyToMap = {};

	for (var domainKey in maps) {
		var map = maps[domainKey];
		var key = map.config.domain + '/datakeys';

		keys.push(key);
		keyToMap[key] = map;

		map.propertyList = [];	// for the cases where there is no propertylist and nothing is returned
	}

	kv.getMany(keys, null, function (error, values) {
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

				value = value.split('|');

				var len = value.length;
				var prefix = map.config.domain + '/data/';

				map.propertyList = new Array(len);

				for (var i = 0; i < len; i++) {
					map.propertyList[i] = prefix + value[i];
				}
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
console.log('got values', values);
			for (var key in values) {
				map.data[key] = values[key];
				console.log('map set', key, '==', values[key]);
			}
			cb(null, map);
		});
	});
};


LivePropertyMap.createMany = function (state, config, options, cb) {
	// create a live property map for each domain

	var maps = {};	// { domainKey: livePropertyMap }, which is the response object

	var propertyListKeys = [];
	var listKeyToMap = {};	// foo/datakeys: map

	for (var domainKey in config.domains) {
		var domain = config.domains[domainKey];

		// create a new config for each domain

		var cfg = { domain: domain };

		for (var key in config) {
			if (key !== 'domains') {
				cfg[key] = config[key];
			}
		}

		var map = new LivePropertyMap(state, cfg, options);

		maps[domainKey] = map;
	}

	// make sure every propertymap becomes aware of its propertylist

	readDomains(state, maps, function (error) {
		if (error) {
			return cb(error);
		}

		// make sure we preload all required properties

		var propertyKeys = [];
		var propertyKeyToMap = {};

		for (var domainKey in maps) {
			var map = maps[domainKey];

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

	var keys;

	if (Array.isArray(options.load)) {
		// load everything requested

		keys = generateFullPropertyKeys(domain, options.load, options.language, options.tags);
	} else if (options.loadAll) {
		// load everything

		var len = this.propertyList.length;

		keys = new Array(len);

		for (var i = 0; i < len; i++) {
			keys[i] = domain + '/data/' + this.propertyList[i];
		}
	} else {
		keys = [];
	}

	return keys;
};


LivePropertyMap.prototype.getRaw = function (propertyName, language, tag) {
	var key;

	if (language) {
		key = generateFullPropertyKey(this.config.domain, propertyName, language, tag);
		if (key in this.data) {
			return this.data[key];
		}

		console.log(key, 'not in', this.data);
	}

	key = generateFullPropertyKey(this.config.domain, propertyName, null, tag);
	if (key in this.data) {
		return this.data[key];
	}

	console.log(key, 'not in', this.data);

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
console.log('get.rawValue', rawValue);
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
			output.push('"' + parsed.replace(/"/g, '\\"') + '":' + this.data[key]);
		}
	}

	return '{' + output.join(',') + '}';
};


LivePropertyMap.prototype.set = function (propertyName, value, language, tag, ttl) {
	// we know that the transactional memcached interface does not require callbacks on mutations (set, del)

	var kv = this.state.datasources.kv;

	var key = generateFullPropertyKey(this.config.domain, propertyName, language, tag);

	kv.set(key, JSON.stringify(value), ttl);

	if (this.propertyList.indexOf(key) === -1) {
		this.propertyList.push(key);

		kv.set(this.config.domain + '/datakeys', this.propertyList.join('|'));
	}
};


LivePropertyMap.prototype.del = function (propertyName, language, tag) {
	// we know that the transactional memcached interface does not require callbacks on mutations (set, del)

	var kv = this.state.datasources.kv;

	var key = generateFullPropertyKey(this.config.domain, propertyName, language, tag);

	kv.del(key);

	var index = this.propertyList.indexOf(key);
	if (index !== -1) {
		this.propertyList.splice(index, 1);

		kv.set(this.config.domain + '/datakeys', this.propertyList.join('|'));
	}
};


LivePropertyMap.prototype.importFromStaticPropertyMap = function (srcMap, language, tags, fnFilter) {

	var map = srcMap.getAllFull(language, tags, fnFilter);

	for (var property in map) {
		for (var i = 0, len = map[property].length; i < len; i++) {
			var obj =  map[property][i];
			this.set(property, obj.value, obj.language, obj.tag);
		}
	}

};
