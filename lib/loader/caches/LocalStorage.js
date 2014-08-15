function key(pkgRequest, subKey) {
	return 'mage-pkg/' + pkgRequest.toString() + '/' + subKey;
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


function LocalStorageCache() {
	if (!window.localStorage) {
		throw new Error('This browser does not have localStorage available');
	}

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


LocalStorageCache.prototype.getMetaData = function (pkgRequest, cb) {
	var result;

	try {
		result = JSON.parse(this.storage.getItem(key(pkgRequest, 'metadata')));
	} catch (error) {
		return this.del(pkgRequest, function () {
			nextTick(cb, [error]);
		});
	}

	return nextTick(cb, [null, result]);
};


LocalStorageCache.prototype.getData = function (pkgRequest, cb) {
	var result;

	try {
		result = this.storage.getItem(key(pkgRequest, 'data'));
	} catch (error) {
		return this.del(pkgRequest, function () {
			return nextTick(cb, [error]);
		});
	}

	return nextTick(cb, [null, result]);
};


LocalStorageCache.prototype.set = function (pkgRequest, metaData, data, cb) {
	try {
		metaData = JSON.stringify(metaData);
	} catch (serializerError) {
		return nextTick(cb, [serializerError]);
	}

	try {
		this.storage.setItem(key(pkgRequest, 'metadata'), metaData);
		this.storage.setItem(key(pkgRequest, 'data'), data);
	} catch (storageError) {
		return nextTick(cb, [storageError]);
	}

	return nextTick(cb);
};


LocalStorageCache.prototype.del = function (pkgRequest, cb) {
	try {
		this.storage.removeItem(key(pkgRequest, 'metadata'));
		this.storage.removeItem(key(pkgRequest, 'data'));
	} catch (error) {
		return nextTick(cb, [error]);
	}

	return nextTick(cb);
};





