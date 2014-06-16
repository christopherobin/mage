var EventEmitter = require('emitter');
var inherits = require('inherit');
var cachepuncher = require('cachepuncher');
var http = require('./http.js');

var Package = require('./Package.js');
var LoadError = require('./LoadError.js');

var cacheStores = {
	Void: require('./caches/Void.js'),
	LocalStorage: require('./caches/LocalStorage.js')
};

var packageType = 'text/component';


/**
 * The MAGE package loader class
 *
 * @constructor
 */

function Loader() {
	EventEmitter.call(this);

	// network

	this.connectionState = 'online';
	this.timeout = 30000;
	this.retryInterval = 1500;

	// packages

	this.packages = {};
	this.activePackage = undefined;

	// cache

	this.cache = null;
	this.cacheStores = cacheStores;
	this.CacheStorage = cacheStores.LocalStorage.test() ?
		cacheStores.LocalStorage :
		cacheStores.Void;

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


/**
 * Tests an HTTP status code and determines if this means the server is in maintenance or not.
 *
 * @param {number} statusCode
 * @returns {boolean}
 */

function isMaintenance(statusCode) {
	return statusCode >= 500 && statusCode <= 599;
}


/**
 * Changes the known state of the server connection to either "online", "offline" or "maintenance".
 * Should only be used by the loader itself, but may be useful for testing.
 *
 * @param {string} state         Either "online", "offline" or "maintenance".
 * @param {string} packageName   The name of the package during the loading of which the state changed.
 * @param {LoadError} [error]    The error that caused this state to change to "offline" or "maintenance".
 */

Loader.prototype._setConnectionState = function (state, packageName, error) {
	if (this.connectionState !== state) {
		this.connectionState = state;
		this.emit(state, packageName, error);
	}
};


/**
 * Configures the loader. This may be called more than once.
 *
 * @param {Object}   cfg                          Configuration object
 * @param {string}   [cfg.appName]                The name of the MAGE application
 * @param {string}   [cfg.clientHostBaseUrl]      The base URL for the downloads
 * @param {Object}   [cfg.appVariants]            Application variants
 * @param {string[]} [cfg.appVariants.languages]  Languages supported by this application
 * @param {number[]} [cfg.appVariants.densities]  Pixel densities supported by this application
 * @param {Object}   [cfg.cors]                   CORS configuration
 */

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
};


Loader.prototype.getCacheStorage = function () {
	if (!this.cache) {
		this.cache = new this.CacheStorage(this.appName, this.language, this.density);
	}

	return this.cache;
};


Loader.prototype.setCacheStorage = function (CacheStorage) {
	if (CacheStorage.test && !CacheStorage.test()) {
		throw new Error('This browser does not support the given CacheStorage');
	}

	this.CacheStorage = CacheStorage;
};

/**
 * Changes the language for upcoming package downloads.
 * Throws an error if the language is not supported by the app's configuration.
 *
 * @param {string} language
 */

Loader.prototype.setLanguage = function (language) {
	language = language.toLowerCase();

	if (this.languages.indexOf(language) === -1) {
		throw new Error('Language "' + language + '" is not supported by this application.');
	}

	this.language = language;
	this.getCacheStorage().setLanguage(language);
};


/**
 * Changes the pixel density for upcoming package downloads.
 * Throws an error if the density is not supported by the app's configuration.
 *
 * @param {number} density
 */

Loader.prototype.setDensity = function (density) {
	if (this.densities.indexOf(density) === -1) {
		throw new Error('Density ' + density + ' is not supported by this application.');
	}

	this.density = density;
	this.getCacheStorage().setDensity(density);
};


/**
 * Throws an error if for whatever reason, a package download for the given package name cannot be
 * initiated.
 *
 * @param {string} packageName  The package name
 */

Loader.prototype.assertPackageIsLoadable = function (packageName) {
	// test the type of the name argument

	if (typeof packageName !== 'string') {
		throw new LoadError('The package name must be a string');
	}

	if (!packageName.length) {
		throw new LoadError('"" is not a valid package name');
	}

	// test that the package has not already been successfully loaded

	if (this.packages.hasOwnProperty(packageName)) {
		throw new LoadError('The "' + packageName + '" package has already been loaded');
	}

	// test that an appName has been configured

	if (!this.appName) {
		throw new LoadError('No appName has been configured yet');
	}
};


/**
 * Returns the URL from which a package will be downloaded.
 *
 * @param {string} packageName   The name of the package
 * @param {string} [hash]        An optional hash to validate the download
 * @returns {string}             The URL leading to the package
 */

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
 * Registers a package. Called from loadPackage, and injecting packages from alternative sources.
 *
 * @param Package pkg
 */

Loader.prototype.registerPackage = function (pkg) {
	// remember the package

	this.packages[pkg.name] = pkg;

	// emit "parsed", allowing post-processors to deal with the content

	this.emit(pkg.name + '.parsed', pkg);
	this.emit('parsed', pkg);

	// run the javascript part immediately

	pkg.runJs();

	// emit "loaded" to indicate that this package can now be fully used

	this.emit(pkg.name + '.loaded', pkg);
	this.emit('loaded', pkg);
};


/**
 * Loads the package by the given name either from cache, or from the MAGE server.
 * Errors:
 * - package cannot be loaded (fatal)
 * - cannot do XHR or CORS on this browser (fatal)
 * - download failed (retries on server error, fatal if client error)
 *
 * Warnings:
 * - package parse error (retries)
 *
 *
 * @param {string} packageName   Package name
 * @param {Function} cb          Can receive an error as its only argument
 */

Loader.prototype.loadPackage = function (packageName, cb) {
	var that = this;

	cb = cb || function () {};

	function autoRetry(loadError) {
		if (loadError) {
			loadError.isRetrying = true;
		}

		window.setTimeout(function () {
			that.loadPackage(packageName, cb);
		}, that.retryInterval);
	}

	function emitWarning(warning) {
		warning.packageName = packageName;

		that.emit('warning', warning, packageName);
		that.emit(packageName + '.warning', warning);
	}

	function emitError(error) {
		error.packageName = packageName;

		that.emit('error', error, packageName);
		that.emit(packageName + '.error', error);

		if (!error.isRetrying) {
			cb(error);
		}
	}

	// make sure this package can be loaded at all and hasn't been loaded yet

	try {
		this.assertPackageIsLoadable(packageName);
	} catch (loadError) {
		return emitError(loadError);
	}


	// check if we have this package in cache, and if we do, what its hash is

	var cache = this.getCacheStorage();

	return cache.getMetaData(packageName, function (error, metaData) {
		if (error) {
			emitWarning(new LoadError('Cache error', null, error));
			// continue, as cache is not required for an app to function
		}

		// create the request

		var hash = metaData && metaData.hash;
		var url = that.getPackageUrl(packageName, hash);

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
					that._setConnectionState('offline', packageName, loadError);
				} else if (isMaintenance(response.code)) {
					// server is under maintenance

					autoRetry(loadError);
					that._setConnectionState('maintenance', packageName, loadError);
				}

				return emitError(loadError);
			}

			that._setConnectionState('online', packageName);

			// turn the response into a Package object

			if (response.contentType !== packageType) {
				emitWarning(new LoadError('Downloaded package is not ' + packageType, response));
			}

			return Package.fromDownload(packageName, response.data, cache, function (error, pkg) {
				if (error) {
					// an error here can be caused by:
					// - a corrupt download
					// - a corrupt cache (which will auto-cleanup, but we still need to start over)

					var loadError = new LoadError('Package parsing failed', response, error);
					autoRetry(loadError);
					return emitError(loadError);
				}

				that.registerPackage(pkg);

				// done!

				return cb();
			});
		});
	});
};


/**
 * Loads all given packages one by one.
 *
 * @param {string[]} packageNames  All the packages to download
 * @param {Function} cb            Called on completion or on error
 */

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


/**
 * Returns an array of all packages loaded so far.
 *
 * @returns {Package[]}
 */

Loader.prototype.listPackages = function () {
	var packages = this.packages;
	var names = Object.keys(packages);

	return names.map(function (name) {
		return packages[name];
	});
};


/**
 * Returns a package by name or throws an error if such a package has not yet been loaded.
 *
 * @param {string} packageName
 * @returns {Package}
 */

Loader.prototype.getPackage = function (packageName) {
	var pkg = this.packages[packageName];
	if (!pkg) {
		throw new Error('Package "' + name + '" has not been loaded (yet).');
	}

	return pkg;
};


/**
 * Returns the last displayed package.
 *
 * @returns {Package}
 */

Loader.prototype.getActivePackage = function () {
	return this.activePackage;
};


/**
 * Creates (if needed) the HTML for the package by the given name and returns it.
 * Note: this is simply a shortcut to getPackage(name).getHtml()
 *
 * @param {string} packageName
 * @returns {HTMLDivElement}
 */

Loader.prototype.getHtml = function (packageName) {
	return this.getPackage(packageName).getHtml();
};


/**
 * Creates (if needed) the HTML for the package by the given name, injects it (if needed) and
 * returns it.
 * Note: this is simply a shortcut to getPackage(name).injectHtml()
 *
 * @param {string} packageName
 * @returns {HTMLDivElement}
 */

Loader.prototype.injectHtml = function (packageName) {
	return this.getPackage(packageName).injectHtml();
};


/**
 * Displays the package with the given name, and hides the currently displayed package.
 * To display a package means that the HTML and CSS are both injected into the document, and HTML
 * no longer carries "display: none". The screen is automatically scrolled to the top.
 *
 * @param {string} packageName
 * @returns {HTMLDivElement}
 */

Loader.prototype.displayPackage = function (packageName) {
	var pkg = this.packages[packageName];
	if (!pkg) {
		throw new Error('Package "' + packageName + '" has not been loaded (yet).');
	}

	// hide the current package

	if (this.activePackage) {
		if (pkg === this.activePackage) {
			// no change
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

	this.emit(packageName + '.display', cnt, pkg);
	this.emit('display', cnt, pkg);

	return cnt;
};


// DEPRECATED API
// --------------

function deprecate(fn, desc) {
	return function () {
		console.warn(new Error('This API has been deprecated: use ' + desc));

		return fn.apply(this, arguments);
	};
}

Loader.prototype.loadPage = deprecate(Loader.prototype.loadPackage, 'loadPackage');
Loader.prototype.addPages = deprecate(Loader.prototype.loadPackages, 'loadPackages');
Loader.prototype.loadPages = deprecate(Loader.prototype.loadPackages, 'loadPackages');
Loader.prototype.getPage = deprecate(Loader.prototype.getHtml, 'getHtml');
Loader.prototype.renderPage = deprecate(Loader.prototype.injectHtml, 'injectHtml');
Loader.prototype.displayPage = deprecate(Loader.prototype.displayPackage, 'displayPackage');
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
// ---------------------


// instantiate the loader singleton

var loader = new Loader();

// automatically configure the loader with the configuration made available by the builder

if (window.mageConfig) {
	loader.configure(window.mageConfig);
}

// expose libraries

// class exposure

loader.Package = Package;
loader.LoadError = LoadError;

// expose

module.exports = loader;
