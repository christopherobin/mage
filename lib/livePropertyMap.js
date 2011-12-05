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
 *   load: ['property', 'property'] (loads given properties)
 *   language: 'EN' (which will load languages 'ALL' and 'EN')
 * }
 */


// TODO: implement a length-getter and perhaps a keys() function, so we can iterate through the properties?


function LivePropertyMap(state, config, options) {
	// config:

	this.state = state;
	this.config = config;
	this.options = options || {};
	this.data = {};
	this.actions = { set: [], del: [] };
	this.propertyList = null;
}


exports.LivePropertyMap = LivePropertyMap;


function generatePropertyListKey(domain) {
	return domain + '/datakeys';
}


function generatePropertyListKeys(domains) {
	var keys = [];

	for (var i = 0, len = domains.length; i < len; i++) {
		keys.push(domains[i] + '/datakeys');
	}

	return keys;
}


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


function parsePropertyKey(key) {
	key = key.split('/');

	var language = key[1];
	if (language === 'ALL') {
		language = null;
	}

	return {
		name: key[0],
		language: language,
		tag: key[2] || null
	};
}


function keyToPropertyName(key) {
	var i = key.indexOf('/');
	if (i > -1) {
		return key.substring(0, i);
	}

	return null;
}


function fullKeyToPropertyName(key) {
	var m = key.match(/\/data\/(.+)$/);
	if (m && m[1]) {
		return keyToPropertyName(m[1]);
	}

	return null;
}


function generateFullPropertyKey(domain, propertyName, language, tag) {
	var key = propertyName + '/' + (language || 'ALL');

	if (tag) {
		key += '/' + tag;
	}

	return domain + '/data/' + key;
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


function readMany(propertyMap, keys, cb) {
	propertyMap.state.datasources.kv.getMany(keys, null, function (error, values) {
		if (error) {
			return cb(error);
		}

		for (var key in values) {
			propertyMap.data[key] = values[key];
		}

		cb(null, values);
	});
}


function readOne(propertyMap, key, required, cb) {
	propertyMap.state.datasources.kv.getOne(key, required, null, function (error, value) {
		if (error) {
			return cb(error);
		}

		propertyMap.data[key] = value;

		cb(null, value);
	});
}


LivePropertyMap.create = function (state, config, options, cb) {
	// creates a LivePropertyMap instance

	var map = new LivePropertyMap(state, config, options);

	// read the list of available properties for this domain

	map.readDomain(function (error) {
		if (error) {
			return cb(error);
		}

		// load the requested properties

		var keys;

		if (Array.isArray(options.load)) {
			// load everything requested

			keys = generateFullPropertyKeys(map.config.domain, options.load, options.language, options.tags);
		} else if (options.loadAll) {
			// load everything

			keys = map.propertyList;
		}

		if (!keys || keys.length === 0) {
			// nothing to load

			return cb(null, map);
		}

		// load keys

		readMany(map, keys, function (error, temp) {
			if (error) {
				return cb(error);
			}

			// readMany already stores on the propertymap, so no need to do anything here

			cb(null, map);
		});
	});
};


LivePropertyMap.createMany = function (state, config, options, cb) {
	// create a live property map for each domain

	var maps = {};
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

		var listKey = domain + '/datakeys';

		propertyListKeys.push(listKey);
		listKeyToMap[listKey] = map;
	}

	// read the list of available properties for these domains

	state.datasources.kv.getMany(propertyListKeys, null, function (error, values) {
		if (error) {
			return error;
		}

		var propKeys = [];	// keys of properties to load
		var propKeyToMap = {};	// property key: property map

		for (var key in values) {
			var map = listKeyToMap[key];
			if (map) {
				// property map object found, apply the properties onto the propertyList

				var value = values[key];

				map.data[key] = value;
				map.propertyList = [];

				if (value) {
					value = value.split('|');

					for (var i = 0, len = value.length; i < len; i++) {
						var propertyName = value[i];
						var propertyKey = map.config.domain + '/data/' + propertyName;

						map.propertyList.push(propertyKey);

						if (options.loadAll || (options.load && options.load.indexOf(propertyName) !== -1)) {
							propKeys.push(propertyKey);
							propKeyToMap[propertyKey] = map;
						}
					}
				}
			}
		}

		// load the requested properties

		if (propKeys.length === 0) {
			return cb(null, maps);
		}

		// load keys

		state.datasources.kv.getMany(propKeys, null, function (error, values) {
			if (error) {
				return cb(error);
			}

			for (var key in values) {
				var map = propKeyToMap[key];
				if (map) {
					map.data[key] = values[key];
				}
			}

			cb(null, maps);
		});
	});
};


LivePropertyMap.prototype.readDomain = function (cb) {
	var domain = this.config.domain;

	if (!domain) {
		return this.state.error(null, 'Cannot read domain information without a domain configuration.', cb);
	}

	var that = this;

	readOne(this, domain + '/datakeys', false, function (error, value) {
		if (error) {
			return cb(error);
		}

		that.propertyList = [];

		if (value) {
			value = value.split('|');

			for (var i = 0, len = value.length; i < len; i++) {
				that.propertyList.push(that.config.domain + '/data/' + value[i]);
			}
		}

		cb();
	});
};


LivePropertyMap.prototype.getRaw = function (propertyName, language, tag) {
	var key;

	if (language) {
		key = generateFullPropertyKey(this.config.domain, propertyName, language, tag);
		if (key in this.data) {
			return this.data[key];
		}
	}

	key = generateFullPropertyKey(this.config.domain, propertyName, null, tag);
	if (key in this.data) {
		return this.data[key];
	}

	return null;

};


LivePropertyMap.prototype.has = function (propertyName, language, tag) {
	var rawValue = this.getRaw(propertyName, language, tag);
	return rawValue !== null;
};


LivePropertyMap.prototype.get = function (propertyName, language, tag) {
	// TODO: this function used to support metadata

	var rawValue = this.getRaw(propertyName, language, tag);

	if (rawValue !== null) {
		try {
			var value = JSON.parse(rawValue);

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
	}

	return null;
};


LivePropertyMap.prototype.getAll = function (language, tag) {
	// TODO: this function used to support metadata

	var result = {};

	for (var key in this.data) {
		var parsed = parseFullPropertyKey(key);	// returns null for the datakeys property

		if (parsed && (!parsed.language || parsed.language === language) && (!parsed.tag || parsed.tag === tag)) {
			try {
				result[parsed.name] = JSON.parse(this.data[key]);
			} catch (e) {
				mithril.core.logger.error('LivePropertyMap parse error', e);
			}
		}
	}

	return result;
};


LivePropertyMap.prototype.toJSON = function () {
	mithril.core.logger.error('Trying to stringify a LivePropertyMap');
};


LivePropertyMap.prototype.stringify = function () {
	var output = [];

	for (var key in this.data) {
		var propertyName = fullKeyToPropertyName(key);

		if (propertyName !== null) {
			output.push('"' + propertyName + '":' + this.data[key]);
		}
	}

	return '{' + output.join(',') + '}';
};


LivePropertyMap.prototype.set = function (propertyName, value, language, tag, ttl) {
	value = JSON.stringify(value);

	this.actions.set.push({ propertyName: propertyName, value: value, language: language, tag: tag, ttl: ttl });
};


LivePropertyMap.prototype.del = function (propertyName, language, tag) {
	this.actions.del.push({ propertyName: propertyName, language: language, tag: tag });
};


LivePropertyMap.prototype.execDeleteActions = function (propertyList, cb) {
	var dels = this.actions.del;
	var listChanged = false;

	if (dels.length === 0) {
		return cb(null, listChanged, propertyList);
	}

	var keys = [];

	for (var i = 0, len = dels.length; i < len; i++) {
		var del = dels[i];
		var key = generateFullPropertyKey(this.config.domain, del.propertyName, del.language, del.tag);

		var index = propertyList.indexOf(key);

		if (index !== -1) {
			keys.push(key);

			delete propertyList[index];
			listChanged = true;
		}
	}

	this.state.datasources.kv.delMany(keys, function (error) {
		if (error) {
			return cb(error);
		}

		cb(null, listChanged, propertyList);
	});
};


LivePropertyMap.prototype.execSetActions = function (propertyList, cb) {
	var sets = this.actions.set;
	var listChanged = false;

	if (sets.length === 0) {
		return cb(null, listChanged, propertyList);
	}

	var ttl, siblings, ttlmap = {};

	for (var i = 0, len = sets.length; i < len; i++) {
		var set = sets[i];

		var key = generateFullPropertyKey(this.config.domain, set.propertyName, set.language, set.tag);
		var value = set.value;
		ttl = set.ttl;

		siblings = ttlmap[ttl || 0];
		if (!siblings) {
			siblings = ttlmap[ttl || 0] = {};
		}

		siblings[key] = value;

		if (propertyList.indexOf(key) === -1) {
			propertyList.push(key);
			listChanged = true;
		}
	}

	var maps = [];

	for (ttl in ttlmap) {
		siblings = ttlmap[ttl];

		maps.push({ ttl: parseInt(ttl, 10) || null, map: siblings });
	}

	var kv = this.state.datasources.kv;

	async.forEachSeries(
		maps,
		function (entry, callback) {
			kv.setMany(entry.map, entry.ttl, callback);
		},
		function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, listChanged, propertyList);
		}
	);
};


LivePropertyMap.prototype.save = function (cb) {
	var that = this;

	// when the datasource becomes transactional, we won't need to try and be clever about bundling sets and deletes

	// property list read required:
	//   if we will write (CAS required)
	//   if options.loadAll (no CAS required)

	var listHasChanged = false;

	this.execDeleteActions(this.propertyList, function (error, listChanged, propertyList) {
		if (error) {
			return cb(error);
		}

		if (listChanged) {
			listHasChanged = true;
		}

		that.execSetActions(propertyList, function (error, listChanged, propertyList) {
			if (error) {
				return cb(error);
			}

			if (listChanged) {
				listHasChanged = true;
			}

			if (listHasChanged) {
				var prefix = that.config.domain + '/data/';

				var propertyNames = [];
				for (var i = 0, len = propertyList.length; i < len; i++) {
					var key = propertyList[i];

					if (key) {
						var propertyName = key.substring(prefix.length);

						propertyNames.push(propertyName);
					}
				}

				that.state.datasources.kv.set(that.config.domain + '/datakeys', propertyNames.join('|'), null, cb);
			} else {
				cb();
			}
		});
	});
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
