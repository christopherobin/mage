var mithril = require('./mithril');


function PropertyMap() {
	this.data = {};
	this.required = [];
}

exports.PropertyMap = PropertyMap;


PropertyMap.unserialize = function (type, value) {
	switch (type) {
	case 'object':
		try {
			value = (value === '') ? null : JSON.parse(value);
		} catch (e) {
			mithril.core.logger.error('Could not unserialize object from string:', value);
			value = {};
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


PropertyMap.serialize = function (value) {
	var result = { type: typeof value };

	switch (result.type) {
	case 'object':
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


PropertyMap.prototype.add = function (property, value, language, tag, meta) {
	var obj = { value: value };

	if (language) {
		obj.language = language;
	}

	if (tag) {
		obj.tag = tag;
	}

	if (meta) {
		obj.meta = meta;
	}

	if (property in this.data) {
		var props = this.data[property];

		for (var i = 0, len = props.length; i < len; i++) {
			// overwrite if language/tag combination already exists for this property

			if (props[i].language === obj.language && props[i].tag === obj.tag) {	// works for undefined as well as defined values
				props[i] = obj;
				return;
			}
		}

		props.push(obj);
	} else {
		this.data[property] = [obj];
	}
};


PropertyMap.prototype.require = function (property, language, tag, optional) {
	this.required.push({ property: property, language: language, tag: tag, optional: optional });
};


PropertyMap.prototype.hasRequirements = function () {
	return (this.required.length > 0);
};


PropertyMap.prototype.fillRequirements = function (srcMap, fnFilter) {
	while (this.required.length > 0) {
		var req = this.required.pop();

		if (req.property in srcMap.data) {
			if (!this.data[req.property]) {
				this.data[req.property] = [];
			}

			var props = srcMap.data[req.property];

			for (var i = 0, len = props.length; i < len; i++) {
				var prop = props[i];

				if (req.language && req.language !== true && prop.language !== req.language) {
					continue;	// language relevant and no match
				}

				if (req.tag && prop.tag !== req.tag) {
					continue;	// tag relevant and no match
				}

				if (!fnFilter || fnFilter(prop)) {
					var obj = { value: prop.value };

					if (prop.language) {
						obj.language = prop.language;
					}

					this.data[req.property].push(obj);
				}
			}
		} else if (!req.optional) {
			return false;
		}
	}

	return true;
};


PropertyMap.prototype.importOne = function (property, type, value, language, tag, meta) {
	this.add(property, PropertyMap.unserialize(type, value), language, tag, meta);
};


PropertyMap.prototype.importFromMap = function (srcMap, language, tags, fnFilter, overwrite) {
	var map = srcMap.getAllFull(language, tags, fnFilter);

	for (var property in map) {
		if (!(property in this.data) || overwrite) {
			this.data[property] = map[property];
		}
	}
};


PropertyMap.prototype.getMetaData = function (property, language, tags, fnFilter, fallback) {
	var props = this.data[property];

	if (!props) {
		return fallback;
	}

	for (var i = 0, len = props.length; i < len; i++) {
		var prop = props[i];

		if (prop.language && prop.language !== language) {
			continue;
		}

		if (tags && prop.tag && tags.indexOf(prop.tag) === -1) {
			continue;
		}

		if (!fnFilter || fnFilter(prop)) {
			return prop.meta;
		}
	}

	return fallback;
};


PropertyMap.prototype.getOne = function (property, language, tags, fnFilter, fallback) {
	var props = this.data[property];

	if (!props) {
		return fallback;
	}

	for (var i = 0, len = props.length; i < len; i++) {
		var prop = props[i];

		if (prop.language && prop.language !== language) {
			continue;
		}

		if (tags && prop.tag && tags.indexOf(prop.tag) === -1) {
			continue;
		}

		if (!fnFilter || fnFilter(prop)) {
			return prop.value;
		}
	}

	return fallback;
};


PropertyMap.prototype.getOneFull = function (property, language, tags, fallback) {
	// if language === true, returns all versions regardless of language
	// if tags === true, returns all versions regardless of tags

	var props = this.data[property];

	if (!props) {
		return fallback;
	}

	var result = [];

	for (var i = 0, len = props.length; i < len; i++) {
		var prop = props[i];

		if (language !== true && prop.language && prop.language !== language) {
			continue;
		}

		if (tags && tags !== true && prop.tag && tags.indexOf(prop.tag) === -1) {
			continue;
		}

		var obj = { value: prop.value };

		if (prop.language) {
			obj.language = prop.language;
		}

		if (prop.tag) {
			obj.tag = prop.tag;
		}

		result.push(obj);
	}

	return result;
};


PropertyMap.prototype.getAll = function (language, tags, fnFilter) {
	var result = {};

	for (var property in this.data) {
		var props = this.data[property];

		for (var i = 0, len = props.length; i < len; i++) {
			var prop = props[i];

			if (prop.language && prop.language !== language) {
				continue;
			}

			if (prop.tag && tags && tags.indexOf(prop.tag) === -1) {
				continue;
			}

			if (!fnFilter || fnFilter(prop)) {
				result[property] = prop.value;
			}
			break;
		}
	}

	return result;
};


PropertyMap.prototype.getAllFull = function (language, tags, fnFilter) {
	// if language === true, returns all versions regardless of language
	// if tags === true, returns all versions regardless of tags

	if (language === true && tags === true && !fnFilter) {
		return this.data;
	}

	var result = {};

	for (var property in this.data) {
		var props = this.data[property];

		for (var i = 0, len = props.length; i < len; i++) {
			var prop = props[i];

			if (language !== true && prop.language && prop.language !== language) {
				continue;
			}

			if (tags !== true && prop.tag && tags && tags.indexOf(prop.tag) === -1) {
				continue;
			}

			if (!fnFilter || fnFilter(prop)) {
				var obj = { value: prop.value };

				if (prop.language) {
					obj.language = prop.language;
				}

				if (prop.tag) {
					obj.tag = prop.tag;
				}

				if (prop.meta) {
					obj.meta = prop.meta;
				}

				if (property in result) {
					result[property].push(obj);
				} else {
					result[property] = [obj];
				}
			}
		}
	}

	return result;
};


PropertyMap.prototype.getAllFlat = function (language, tags, fnFilter) {
	var result = [];
	var mapped = this.getAllFull(language, tags, fnFilter);

	for (var property in mapped) {
		var props = mapped[property];

		for (var i = 0, len = props.length; i < len; i++) {
			var prop = props[i];

			if (language !== true && prop.language && prop.language !== language) {
				continue;
			}

			if (tags && tags !== true && prop.tag && tags.indexOf(prop.tag) === -1) {
				continue;
			}

			if (!fnFilter || fnFilter(prop)) {
				var obj = PropertyMap.serialize(prop.value);

				obj.property = property;

				if (prop.language) {
					obj.language = prop.language;
				}

				if (prop.tag) {
					obj.tag = prop.tag;
				}

				if (prop.meta) {
					obj.meta = prop.meta;
				}

				result.push(obj);
			}
		}
	}

	return result;
};


PropertyMap.prototype.exportOne = function (property, language, tags, fnFilter, fallback) {
	var result = this.getOne(property, language, tags, fnFilter);

	if (result === undefined) {
		return fallback;
	}

	return PropertyMap.serialize(result, fallback);
};


PropertyMap.prototype.exportAll = function (language, tags, fnFilter) {
	var result = this.getAll(language, tags, fnFilter);

	for (var property in result) {
		result[property] = PropertyMap.serialize(result[property]);
	}

	return result;
};

