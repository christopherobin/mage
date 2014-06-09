var EventEmitter = require('emitter');
var inherits = require('inherit');
var cachepuncher = require('cachepuncher');
var http = require('./http.js');

var Package = require('./Package.js');
var LocalStorageCache = require('./caches/LocalStorage.js');
var VoidCache = require('./caches/Void.js');

var packageType = 'text/component';


function LoadError(message, response, errorObj) {
	Error.call(this);

	this.message = message;      // human readable
	this.response = response;    // (optional) HTTP response
	this.error = errorObj;       // (optional) error object that caused this
	this.isRetrying = false;     // true if Loader is retrying and no human intervention is needed
	this.packageName = null;     // error happened while loading this package
}

inherits(LoadError, Error);


function Loader() {
	EventEmitter.call(this);

	// network

	this.connectionState = 'online';
	this.timeout = 30000;
	this.retryInterval = 1500;

	// packages

	this.packages = {};
	this.activePackage = null;

	// cache

	this.cache = new VoidCache();

	// configuration

	this.clientHostBaseUrl = '';
	this.appName = null;
	this.languages = ['en'];
	this.language = 'en';
	this.densities = [1];
	this.density = 1;
	this.cors = null;
}

inherits(Loader, EventEmitter);


function isMaintenance(statusCode) {
	return statusCode >= 500 && statusCode <= 599;
}


Loader.prototype.setConnectionState = function (state, packageName, error) {
	if (this.connectionState !== state) {
		this.connectionState = state;
		this.emit(state, packageName, error);
	}
};


// public api

Loader.prototype.configure = function (cfg) {
	if (!cfg) {
		throw new ReferenceError('No configuration provided.');
	}

	if (cfg.appName) {
		if (typeof cfg.appName !== 'string') {
			throw new TypeError('config.appName must be a string');
		}

		this.appName = cfg.appName;
	}

	if (cfg.clientHostBaseUrl) {
		if (typeof cfg.clientHostBaseUrl !== 'string') {
			throw new TypeError('config.clientHostBaseUrl must be a string');
		}

		this.clientHostBaseUrl = cfg.clientHostBaseUrl;
	}


	if (cfg.appVariants) {
		if (cfg.appVariants.languages && cfg.appVariants.languages.length > 0) {
			this.languages = cfg.appVariants.languages;
			this.language = this.languages[0];
		}

		if (cfg.appVariants.densities && cfg.appVariants.densities.length > 0) {
			this.densities = cfg.appVariants.densities;
			this.density = this.densities[0];
		}
	}

	if (cfg.cors) {
		this.cors = cfg.cors;
	}

	if (LocalStorageCache.test()) {
		this.cache = new LocalStorageCache(this.appName, this.language, this.density);
	}
};


Loader.prototype.setLanguage = function (newLanguage) {
	newLanguage = newLanguage.toLowerCase();

	if (this.languages.indexOf(newLanguage) === -1) {
		throw new Error('Language "' + newLanguage + '" is not supported by this application.');
	}

	this.language = newLanguage;
};


Loader.prototype.setDensity = function (newDensity) {
	if (this.densities.indexOf(newDensity) === -1) {
		throw new Error('Density ' + newDensity + ' is not supported by this application.');
	}

	this.density = newDensity;
};


Loader.prototype.assertPackageIsLoadable = function (name) {
	// test the type of the name argument

	if (typeof name !== 'string') {
		throw new LoadError('The package name must be a string');
	}

	if (!name.length) {
		throw new LoadError('"" is not a valid package name');
	}

	// test that the package has not already been successfully loaded

	if (this.packages.hasOwnProperty(name)) {
		throw new LoadError('The "' + name + '" package has already been loaded');
	}

	// test that an appName has been configured

	if (!this.appName) {
		throw new LoadError('No appName has been configured yet');
	}
};


Loader.prototype.getPackageUrl = function (packageName, hash) {
	var params = [];

	var screen = window.screen || {};

	params.push('language=' + encodeURIComponent(this.language));
	params.push('screen=' + (screen.width || '0') + 'x' + (screen.height || '0'));
	params.push('density=' + encodeURIComponent(this.density));

	if (hash) {
		params.push('hash=' + encodeURIComponent(hash));
	}

	// avoid browser cache

	params.push('rand=' + encodeURIComponent(cachepuncher.punch()));

	return this.clientHostBaseUrl + '/app/' + this.appName + '/' + packageName + '?' + params.join('&');
};

/**
 * Loads the package by the given name from either cache, or from the MAGE server.
 * Errors:
 * - package cannot be loaded (fatal)
 * - cannot do XHR or CORS on this browser (fatal)
 * - download failed (retries on server error, fatal if client error)
 *
 * Warnings:
 * - package parse error (retries)
 *
 *
 * @param {string} name   Package name
 * @param {Function} cb   Can receive an error
 */

Loader.prototype.loadPackage = function (name, cb) {
	var that = this;

	cb = cb || function () {};

	function autoRetry(loadError) {
		if (loadError) {
			loadError.isRetrying = true;
		}

		window.setTimeout(function () {
			that.loadPackage(name, cb);
		}, that.retryInterval);
	}

	function emitWarning(warning) {
		warning.packageName = name;

		that.emit('warning', warning, name);
		that.emit(name + '.warning', warning);
	}

	function emitError(error) {
		error.packageName = name;

		that.emit('error', error, name);
		that.emit(name + '.error', error);

		if (!error.isRetrying) {
			cb(error);
		}
	}

	// make sure this package can be loaded at all and hasn't been loaded yet

	try {
		this.assertPackageIsLoadable(name);
	} catch (loadError) {
		return emitError(loadError);
	}


	// check if we have this package in cache, and if we do, what its hash is

	return this.cache.getMetaData(name, function (error, metaData) {
		if (error) {
			emitWarning(new LoadError('Cache error', null, error));
			// continue, as cache is not required for an app to function
		}

		// create the request

		var hash = metaData && metaData.hash;
		var url = that.getPackageUrl(name, hash);

		var request;

		var options = {
			cors: that.cors,
			timeout: that.timeout
		};

		try {
			request = http.createRequest(url, options);
		} catch (reqError) {
			return emitError(new LoadError(error.message, null, error));
		}

		// make the request

		return request(function (error, response) {
			if (error) {
				var loadError = new LoadError('Download failed', response, error);

				if (!response) {
					// request timed out

					autoRetry(loadError);
					that.setConnectionState('offline');
				} else if (isMaintenance(response.code)) {
					// server is under maintenance

					autoRetry(loadError);
					that.setConnectionState('maintenance');
				}

				return emitError(loadError);
			}

			that.setConnectionState('online');

			// turn the response into a Package object

			if (response.contentType !== packageType) {
				emitWarning(new LoadError('Downloaded package is not ' + packageType, response));
			}

			return Package.fromDownload(name, response.data, that.cache, function (error, pkg) {
				if (error) {
					// an error here can be caused by:
					// - a corrupt download
					// - a corrupt cache (which will auto-cleanup, but we still need to start over)

					var loadError = new LoadError('Package parsing failed', response, error);
					autoRetry(loadError);
					return emitError(loadError);
				}

				// remember the package

				that.packages[name] = pkg;

				// emit "parsed", allowing post-processors to deal with the content

				that.emit(name + '.parsed', pkg);
				that.emit('parsed', pkg);

				// run the javascript part immediately

				pkg.runJs();

				// emit "loaded" to indicate that this package can now be fully used

				that.emit(name + '.loaded', pkg);
				that.emit('loaded', pkg);

				// done!

				return cb();
			});
		});
	});
};


Loader.prototype.loadPackages = function (packageNames, cb) {
	var that = this;

	packageNames = packageNames.slice();
	cb = cb || function () {};

	function next(error) {
		if (error) {
			return cb(error);
		}

		var packageName = packageNames.shift();

		if (packageName) {
			that.loadPackage(packageName, next);
		} else {
			cb();
		}
	}

	next();
};


Loader.prototype.listPackages = function () {
	var packages = this.packages;
	var names = Object.keys(packages);

	return names.map(function (name) {
		return packages[name];
	});
};


Loader.prototype.getPackage = function (packageName) {
	return this.packages[packageName];
};


Loader.prototype.getActivePackage = function () {
	return this.activePackage;
};


Loader.prototype.getHtml = function (name) {
	var pkg = this.packages[name];
	if (!pkg) {
		throw new Error('Package "' + name + '" has not been loaded (yet).');
	}

	return pkg.getHtml();
};


Loader.prototype.injectHtml = function (name) {
	var pkg = this.packages[name];
	if (!pkg) {
		throw new Error('Package "' + name + '" has not been loaded (yet).');
	}

	return pkg.injectHtml();
};


Loader.prototype.displayPackage = function (name) {
	var pkg = this.packages[name];
	if (!pkg) {
		throw new Error('Package "' + name + '" has not been loaded (yet).');
	}

	// hide the current package

	if (this.activePackage) {
		if (pkg === this.activePackage) {
			return;
		}

		// emit close event

		this.emit(this.activePackage.name + '.close', this.activePackage);
		this.emit('close', this.activePackage);

		this.activePackage.hideHtml();
		this.activePackage.ejectCss();
	}

	// scroll to top

	document.body.scrollIntoView(true);

	// show the package

	this.activePackage = pkg;

	pkg.injectCss();
	var cnt = pkg.showHtml();

	this.emit(name + '.display', cnt, pkg);
	this.emit('display', cnt, pkg);

	return cnt;
};


// DEPRECATED API

function deprecate(fn, desc) {
	return function () {
		console.warn(new Error('This API has been deprecated: use ' + desc));

		return fn.apply(this, arguments);
	};
}

Loader.prototype.addPages = deprecate(Loader.prototype.addPackages, 'addPackages');
Loader.prototype.loadPages = deprecate(Loader.prototype.loadPackages, 'loadPackages');
Loader.prototype.renderPage = deprecate(Loader.prototype.injectHtml, 'injectHtml');
Loader.prototype.displayPage = deprecate(Loader.prototype.displayPackage, 'displayPackage');
Loader.prototype.getPage = deprecate(Loader.prototype.getHtml, 'getHtml');
Loader.prototype.addPages = deprecate(Loader.prototype.loadPackages, 'loadPackages');

Loader.prototype.loadNextPage = function () {
	throw new Error('loadNextPage is no longer supported, please use loadPackages');
};

Loader.prototype.getDisplayedPage = deprecate(
	function () {
		return Loader.prototype.getActivePackage().getHtml();
	},
	'getActivePackage().getHtml()'
);

// END OF DEPRECATED API


// instantiate

var loader = new Loader();

// automatically configure the loader with the config made available by the builder

if (window.mageConfig) {
	loader.configure(window.mageConfig);
}

// expose

module.exports = loader;
