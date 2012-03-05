function isEmpty(obj) {
	if (obj === null) {
		return true;
	}

	switch (typeof obj) {
	case 'undefined':
		return true;
	case 'object':
		return (Object.keys(obj).length === 0);
	case 'string':
		return (obj.length === 0);
	case 'number':
		return (obj === 0);
	case 'boolean':
		return (obj === false);
	case 'function':
		return false;
	}

	return false;
}

function isEqual(a, b) {
	if (typeof a !== typeof b) {
		return false;
	}

	if (a === b) {
		return true;
	}

	if (typeof a === 'function') {
		return (a.toString() === b.toString());
	}

	if (typeof a === 'object') {
		// first check class type

		if (a.prototype !== b.prototype) {
			return false;
		}

		if (a.toString() !== b.toString()) {
			return false;
		}

		if (a instanceof Array) {
			// check array values

			if (a.length !== b.length) {
				return false;
			}

			for (var i = 0; i < a.length; i++) {
				if (!isEqual(a[i], b[i])) {
					return false;
				}
			}
		} else {
			// first check keys

			var aKeys = Object.keys(a);
			var bKeys = Object.keys(b);

			if (aKeys.length !== bKeys.length) {
				return false;
			}

			// now check values

			for (var key in a) {
				if (!(key in b)) {
					return false;
				}

				if (!isEqual(a[key], b[key])) {
					return false;
				}
			}
		}
		return true;
	}

	return false;
}

function flattenProperties(data) {
	var properties = [];

	for (var prop in data) {
		var value = data[prop];
		var result = { property: prop, type: typeof value };

		switch (result.type) {
			case 'object':
				if (typeof value.getRaw === 'function') {
					value = value.getRaw();
				}

				if (value.lang) {
					result.type  = 'string';
					result.lang  = value.lang;
					result.value = value.val;
				} else {
					result.value = JSON.stringify(value);
				}

				break;

			case 'boolean':
				result.value = value ? '1' : '0';
				break;

			default:
				result.value = value;
				break;
		}

		properties.push(result);
	}

	return properties;
}


function unflattenProperties(data) {
	var properties = {};
	for (var i = 0, len = data.length; i < len; i++) {
		var propName = data[i].property;
		properties[propName] = {};

		switch (data[i].type) {
			case 'string':
				properties[propName] = data[i].value;
				break;

			case 'number':
				properties[propName] = parseInt(data[i].value, 10);
				break;

			case 'bool':
				properties[propName] = (data[i].value === 'true');
				break;

			case 'object':
				try {
					properties[propName] = JSON.parse(data[i].value);
				} catch (e) {
					mithril.core.logger.error('Could not JSON.parse data : ', data[i], ' -- error : ', e);
				}
				break;

			default:
				break;
		}
	}

	return properties;
}
