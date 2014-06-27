function VoidCache() {
}

module.exports = VoidCache;


VoidCache.test = function () {
	return true;
};


VoidCache.prototype.setLanguage = function () {};
VoidCache.prototype.setDensity = function () {};


VoidCache.prototype.getMetaData = function (packageName, cb) {
	cb();
};


VoidCache.prototype.getData = function (packageName, cb) {
	cb(new Error('Data not in void cache'));
};


VoidCache.prototype.set = function (packageName, metaData, data, cb) {
	cb();
};


VoidCache.prototype.del = function (packageName, cb) {
	cb();
};
