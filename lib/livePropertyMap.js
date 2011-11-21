var mithril = require('./mithril'),
    async = require('async');

/* Required columns:
 *   property, language, type, value
 * Optional column:
 *   tag
 *
 * Example config:
 * {
 *   tableName:   'shop_data',
 *   columns:     ['shopId', 'property', 'language' 'type', 'value'],
 *   fixedValues: { shopId: 3 }
 * }
 *
 * Example options (user driven):
 * {
 *   allLanguages: true (if falsy, state.language() is used)
 *   loadAll: true (loads all properties)
 *   load: ['propname', 'propname'] (loads given properties)
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
}


exports.LivePropertyMap = LivePropertyMap;


LivePropertyMap.unserialize = function (type, value) {
	switch (type) {
	case 'object':
		try {
			value = (value === '') ? null : JSON.parse(value);
		} catch (e) {
			mithril.core.logger.error('Could not unserialize object from string:', value);
			value = {};
		}

		var specialType = value.__type;
		if (specialType) {
			value = mithril.core.datatypes.createValue(specialType, value);
		}

		break;

	case 'number':
		value = parseFloat(value);
		break;

	case 'boolean':
		value = (value === 'false' || value === '0' || value === '') ? false : true;
		break;

	// string remains a string
	}

	return value;
};


LivePropertyMap.serialize = function (value) {
	var result = { type: typeof value };

	switch (result.type) {
	case 'object':
/*
		if (typeof value.getRaw === 'function') {
			value = value.getRaw();
		}
*/
		result.value = JSON.stringify(value);
		break;

	case 'boolean':
		result.value = value ? '1' : '0';
		break;

	default:
		result.value = value;
		break;
	}

	return result;
};


function loadPropertyData(state, config, options, cb) {
	if (!options.loadAll && (!options.load || options.load.length === 0)) {
		return cb(null, []);
	}

	var db = state.datasources.db;

	var where = [];
	var params = [];

	for (var key in config.fixedValues) {
		var values = config.fixedValues[key];

		if (!Array.isArray(values)) {
			values = [values];
		}

		var nullPos = values.indexOf(null);

		if (nullPos === -1) {
			where.push(key + ' IN (' + db.getPlaceHolders(values.length) + ')');
			params = params.concat(values);
		} else {
			values.splice(nullPos, 1);

			if (values.length > 0) {
				where.push('(' + key + ' IS NULL OR ' + key + ' IN (' + db.getPlaceHolders(values.length) + '))');
				params = params.concat(values);
			} else {
				where.push(key + ' IS NULL');
			}
		}
	}

	if (!options.allLanguages) {
		where.push('language IN (?, ?)');

		if (options.language) {
			params.push('', options.language);
		} else {
			params.push('', state.language());
		}
	}

	if (!options.loadAll) {
		where.push('property IN (' + db.getPlaceHolders(options.load.length) + ')');
		params = params.concat(options.load);
	}

	var sql = 'SELECT * FROM ' + config.tableName;

	if (where.length > 0) {
		sql += ' WHERE ' + where.join(' AND ');
	}

	db.getMany(sql, params, null, cb);
}


function inject(data, row) {
	// data = { propertyName: { languageCode: [row] } }

	var property = row.property;
	var language = row.language;

	row.value = LivePropertyMap.unserialize(row.type, row.value);

	delete row.property;
	delete row.language;
	delete row.type;

	data[property] = data[property] || {};
	data[property][language] = data[property][language] || [];
	data[property][language].push(row);
}


LivePropertyMap.create = function (state, config, options, cb) {
	// creates a LivePropertyMap instance

	var prop = new mithril.core.LivePropertyMap(state, config, options);

	loadPropertyData(state, config, options, function (error, rows) {
		if (error) {
			return cb(error);
		}

		for (var i = 0, len = rows.length; i < len; i++) {
			inject(prop.data, rows[i]);
		}

		cb(null, prop);
	});
};


LivePropertyMap.createMany = function (state, config, options, cb) {
	// creates a bunch of LivePropertyMap instances

	// config.fixedValues[config.key] will have to be an array of values.
	// A LivePropertyMap will be created for all of them.

	var values = config.fixedValues[config.key];
	var maps = {};

	for (var i = 0, len = values.length; i < len; i++) {
		// generate a config for each property map

		var value = values[i];

		var cfg = {
			tableName: config.tableName,
			columns: config.columns,
			fixedValues: {},
			key: config.key
		};

		for (var key in config.fixedValues) {
			if (key === config.key) {
				cfg.fixedValues[key] = value;
			} else {
				cfg.fixedValues[key] = config.fixedValues[key];
			}
		}

		maps[value] = new LivePropertyMap(state, cfg, options);
	}

	loadPropertyData(state, config, options, function (error, rows) {
		if (error) {
			return cb(error);
		}

		for (var i = 0, len = rows.length; i < len; i++) {
			var row = rows[i];
			var keyValue = row[config.key];
			var map = maps[keyValue];

			if (map) {
				inject(map.data, row);
			}
		}

		cb(null, maps);
	});
};


// Q: where do we ever call get/getAll and require it to respond with tags, metadata?
// can we turn get into: get(property) and have it use the state.language() and options.language()?
// for the special cases where we need tag/metadata support, we could just make specialized functions

LivePropertyMap.prototype.get = function (property, language, tag, includeMetaData) {
	var prop = this.data[property];

	if (prop) {
		prop = prop[language || ''] || prop[''];

		if (prop) {
			for (var i = 0, len = prop.length; i < len; i++) {
				var row = prop[i];

				if (!tag || !row.tag || row.tag === tag) {
					return includeMetaData ? row : row.value;
				}
			}
		}
	}

	return null;
};


LivePropertyMap.prototype.getAll = function (language, tag, includeMetaData) {
	var result = {};

	for (var property in this.data) {
		result[property] = this.get(property, language, tag, includeMetaData);
	}

	return result;
};


LivePropertyMap.prototype.toJSON = function () {
	return this.getAll();
};


LivePropertyMap.prototype.set = function (property, value, language, tag) {
	var serialized = LivePropertyMap.serialize(value);

	this.actions.set.push({ property: property, value: serialized.value, type: serialized.type, language: language || '', tag: tag || '' });
};


LivePropertyMap.prototype.del = function (property, language, tag) {
	this.actions.del.push({ property: property, language: language, tag: tag });
};


LivePropertyMap.prototype.save = function (cb) {
	var state = this.state;
	var db = state.datasources.db;
	var cfg = this.config;
	var actions = this.actions;

	async.series([
		function (callback) {
			// delete those properties scheduled for deletion

			if (actions.del.length === 0) {
				return callback();
			}

			var sql = 'DELETE FROM ' + cfg.tableName;
			var where = [];
			var params = [];

			for (var col in cfg.fixedValues) {
				var value = cfg.fixedValues[col];

				if (value === null) {
					where.push(col + ' IS NULL');
				} else {
					where.push(col + ' = ?');
					params.push(value);
				}
			}

			var recordConds = [];	// will be OR-ed

			for (var i = 0, len = actions.del.length; i < len; i++) {
				var prop = actions.del[i];

				var sub = ['property = ?'];
				params.push(prop.property);

				if (prop.language) {
					sub.push('language = ?');
					params.push(prop.language);
				}

				if (prop.tag) {
					sub.push('tag = ?');
					params.push(prop.tag);
				}

				recordConds.push('(' + sub.join(' AND ') + ')');
			}

			where.push('(' + recordConds.join(' OR ') + ')');

			if (where.length > 0) {
				sql += ' WHERE ' + where.join(' AND ');
			}

			db.exec(sql, params, null, callback);
		},
		function (callback) {
			// set properties

			if (actions.set.length === 0) {
				return callback();
			}

			var colCount = cfg.columns.length;

			var sql = 'INSERT INTO ' + cfg.tableName + ' (' + cfg.columns.join(', ') + ') VALUES ';
			var values = [];
			var params = [];

			for (var i = 0, len = actions.set.length; i < len; i++) {
				var prop = actions.set[i];

				values.push('(' + db.getPlaceHolders(colCount) + ')');

				for (var j = 0; j < colCount; j++) {
					var col = cfg.columns[j];

					if (col in cfg.fixedValues) {
						params.push(cfg.fixedValues[col]);
					} else if (col in prop) {
						params.push(prop[col]);
					} else {
						return state.error(null, 'Value for column "' + cfg.tableName + '.' + col + '" not given.', callback);
					}
				}
			}

			sql += values.join(', ') + ' ON DUPLICATE KEY UPDATE type = VALUES(type), value = VALUES(value)';

			db.exec(sql, params, null, callback);
		}
	],
	function (error) {
		cb(error);
	});
};

