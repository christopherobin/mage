function key(config, packageName, subKey) {
	var parts = [
		config.appName,
		packageName,
		config.language,
		config.density,
		subKey
	];

	return parts.join('/');
}


function nextTick(cb, args) {
	if (!cb) {
		return;
	}

	return window.setTimeout(function () {
		if (args) {
			cb.apply(null, args);
		} else {
			cb();
		}
	}, 0);
}


function LocalStorageCache(appName, language, density) {
	if (!window.localStorage) {
		throw new Error('This browser does not have localStorage available');
	}

	this.config = {
		appName: appName,
		language: language,
		density: density
	};

	this.storage = window.localStorage;
}

module.exports = LocalStorageCache;


LocalStorageCache.test = function () {
	var storage = window.localStorage;

	if (storage && storage.setItem && storage.getItem && storage.removeItem) {
		return true;
	}

	return false;
};


LocalStorageCache.prototype.setLanguage = function (language) {
	this.config.language = language;
};


LocalStorageCache.prototype.setDensity = function (density) {
	this.config.density = density;
};


LocalStorageCache.prototype.getMetaData = function (packageName, cb) {
	var result;

	try {
		result = JSON.parse(this.storage.getItem(key(this.config, packageName, 'metadata')));
	} catch (error) {
		return this.del(packageName, function () {
			nextTick(cb, [error]);
		});
	}

	return nextTick(cb, [null, result]);
};


LocalStorageCache.prototype.getData = function (packageName, cb) {
	var result;

	try {
		result = this.storage.getItem(key(this.config, packageName, 'data'));
	} catch (error) {
		return this.del(packageName, function () {
			return nextTick(cb, [error]);
		});
	}

	return nextTick(cb, [null, result]);
};


LocalStorageCache.prototype.set = function (packageName, metaData, data, cb) {
	try {
		metaData = JSON.stringify(metaData);
	} catch (serializerError) {
		return nextTick(cb, [serializerError]);
	}

	try {
		this.storage.setItem(key(this.config, packageName, 'metadata'), metaData);
		this.storage.setItem(key(this.config, packageName, 'data'), data);
	} catch (storageError) {
		return nextTick(cb, [storageError]);
	}

	return nextTick(cb);
};


LocalStorageCache.prototype.del = function (packageName, cb) {
	try {
		this.storage.removeItem(key(this.config, packageName, 'metadata'));
		this.storage.removeItem(key(this.config, packageName, 'data'));
	} catch (error) {
		return nextTick(cb, [error]);
	}

	return nextTick(cb);
};





