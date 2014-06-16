var mime = require('./mime.js');


/**
 * Represents a downloadable package of HTML, CSS, JavaScript and any other content type
 *
 * @param {string} name  The name of the package
 * @constructor
 */

function Package(name) {
	this.name = name;

	// the original strings representing the content
	// they are automatically cleaned up when possible to preserve memory

	this.content = {};

	// the <style> and <div> elements

	this.containers = {};

	// where to inject style and div tags

	this.parentElements = {
		'text/html': document.body,
		'text/css': document.head
	};
}

module.exports = Package;


// ----------------------------
// Static API for instantiation
// ----------------------------

/**
 * Parses a string into its various pieces of content and stores those in the package's "content"
 * object.
 *
 * @param {string} data  The data to parse and store inside the package
 * @returns {Object}     The meta data that was parsed (containing hash and delimiter)
 */

Package.prototype.parse = function (data) {
	// parse out meta data, which should at least contain a part-delimiter string

	var metaData = {};
	var i, len;

	var index = data.indexOf('\n\n');
	if (index !== -1) {
		var lines = data.substring(0, index).split('\n');
		data = data.substring(index + 2);

		for (i = 0, len = lines.length; i < len; i++) {
			var line = lines[i].split(':');

			var key = line.shift().trim().toLowerCase();
			var value = line.join(':').trim();

			metaData[key] = value;
		}
	}

	if (typeof metaData.delimiter !== 'string' || !metaData.delimiter.length) {
		throw new Error('No valid part-delimiter found in package data');
	}


	var parts = data.split(metaData.delimiter);

	for (i = 0, len = parts.length; i < len; i++) {
		var part = parts[i];
		var offset = -1;
		var eol;

		do {
			offset += 1;
			eol = part.indexOf('\n', offset);
		} while (offset === eol && eol !== -1);

		if (eol === -1) {
			throw new Error('Could not find content-type in package part.');
		}

		var contentType = mime.parse(part.substring(offset, eol));
		var content = part.substring(eol + 1);

		// store the content

		if (contentType) {
			this.content[contentType.type] = this.content[contentType.type] || [];
			this.content[contentType.type].push(content);
		}
	}

	return metaData;
};


/**
 * Creates a package from string data and stores it in the cache library if provided.
 *
 * @param {string}      name   The package name
 * @param {string}      data   The data to parse
 * @param {Object|null} cache  A storage cache
 * @param {Function}    cb     Callback, called on completion
 */

Package.fromData = function (name, data, cache, cb) {
	if (!data) {
		return cb(new Error('Package data is empty'));
	}

	var metaData;
	var pkg = new Package(name);

	try {
		metaData = pkg.parse(data);
	} catch (error) {
		return cb(error);
	}

	if (cache) {
		// asynchronous to the callback, there is no need to wait for I/O here

		try {
			cache.set(name, metaData, data);
		} catch (cacheError) {
			// ignore all errors
		}
	}

	return cb(null, pkg);
};


/**
 * Creates a package by reading it from the provided cache library
 *
 * @param {string}      name   The package name
 * @param {Object|null} cache  A storage cache
 * @param {Function}    cb     Callback, called on completion
 */

Package.fromCache = function (name, cache, cb) {
	cache.getData(name, function (error, data) {
		if (error) {
			return cb(error);
		}

		return Package.fromData(name, data, null, cb);
	});
};


/**
 * Creates a package from a downloaded response, which may either indicate a requirement to read
 * from cache, or a requirement to parse and store to cache.
 *
 * @param {string}      name   The package name
 * @param {string}      data   The data to parse or "usecache" if our cached version is up-to-date
 * @param {Object|null} cache  A storage cache
 * @param {Function}    cb     Callback, called on completion
 */

Package.fromDownload = function (name, data, cache, cb) {
	if (typeof data !== 'string') {
		return cb(new TypeError('Package data must be a string'));
	}

	if (data.substr(0, 8) === 'usecache') {
		Package.fromCache(name, cache, cb);
	} else {
		Package.fromData(name, data, cache, cb);
	}
};


// -------------------------
// Content-type agnostic API
// -------------------------

/**
 * Extracts downloaded content of a given type, removes it from memory and returns it. Packages may
 * contain multiple pieces of content of one type. Every time this function is called, it returns
 * one piece. This function may thus be repeated until undefined is returned.
 *
 * @param {string} type   The content-type
 * @returns {string}
 */

Package.prototype.claimContent = function (type) {
	if (!type || typeof type !== 'string') {
		throw new TypeError('You must provide a valid content-type (string)');
	}

	var list = this.content[type];

	if (!list || list.length === 0) {
		return;
	}

	return list.shift();
};


/**
 * Extracts all downloaded content of a given type, removing them from memory and returning them,
 * joined together with the given glue.
 *
 * @param {string} type   The content-type
 * @param {string} [glue] The string to join the content with, "\n" by default
 * @returns {string}
 */

Package.prototype.claimAllContent = function (type, glue) {
	if (!type || typeof type !== 'string') {
		throw new TypeError('You must provide a valid content-type (string)');
	}

	if (glue === undefined) {
		glue = '\n';
	}

	var list = this.content[type];
	if (!list || list.length === 0) {
		return;
	}

	var content = list.join(glue);
	this.content[type] = [];

	return content;
};


/**
 * Injects content into the given parent element
 *
 * @param {Element} elm     The element to inject
 * @param {Element} parent  The parent element to append to
 * @returns {Element}       The injected element
 */

Package.prototype.injectElement = function (elm, parent) {
	if (!elm) {
		throw new Error('No element to inject');
	}

	if (!parent) {
		throw new Error('No parent element to append to');
	}

	if (parent !== elm.parentNode) {
		parent.appendChild(elm);
	}

	return elm;
};


/**
 * Ejects content from its parent element
 *
 * @param {string} type   The content-type
 * @returns {Element}     The ejected element
 */

Package.prototype.ejectElement = function (type) {
	var elm = this.containers[type];
	if (!elm) {
		throw new Error('There is no container for type "' + type + '" to eject');
	}

	if (elm.parentNode) {
		elm.parentNode.removeChild(elm);
	}

	return elm;
};


/**
 * Ejects the container of the given content type, and forgets about its existence.
 *
 * @param {string} type   The content-type
 * @returns {Element}     The ejected (and forgotten) element
 */

Package.prototype.destroyElement = function (type) {
	var elm = this.ejectElement(type);
	if (!elm) {
		return;
	}

	delete this.containers[type];
	return elm;
};


/**
 * Destroys any remaining content strings and elements.
 */

Package.prototype.destroy = function () {
	var types = Object.keys(this.containers);
	for (var i = 0; i < types.length; i += 1) {
		var type = types[i];

		this.destroyElement(type);
	}

	this.content = {};
};


// -----------------------
// JavaScript specific API
// -----------------------

/**
 * Execute the JavaScript in this package
 */

Package.prototype.runJs = function () {
	var content = this.claimAllContent('text/javascript');

	if (content) {
		/*jshint evil:true */
		new Function(content)();
	}
};


// -----------------
// HTML specific API
// -----------------

/**
 * Static function to instantiate a package's HTML.
 *
 * @param {string} content    The HTML content
 * @param {string} name       The package name
 * @returns {HTMLDivElement}  A <div> element that now contains the given content
 */

Package.createHtml = function (content, name) {
	var cnt = document.createElement('div');
	cnt.className = 'mage-package';
	cnt.className += ' mage-page ';  // deprecated

	if (name) {
		cnt.setAttribute('data-package', name);
		cnt.setAttribute('data-page', name);  // deprecated
	}

	// start hidden

	cnt.style.display = 'none';

	// inject HTML from the package

	if (content) {
		cnt.innerHTML = content;
	}

	return cnt;
};


/**
 * Creates (if needed) and returns the HTML container for this package.
 *
 * @returns {HTMLDivElement}  The <div> container for this package.
 */

Package.prototype.getHtml = function () {
	var type = 'text/html';
	var cnt = this.containers[type];

	if (!cnt) {
		cnt = Package.createHtml(this.claimAllContent(type), this.name);

		this.containers[type] = cnt;
	}

	return cnt;
};


/**
 * Creates (if needed) and injects the HTML container for this package into a given parent.
 *
 * @param {Element}           The parent to append to.
 * @returns {HTMLDivElement}  The <div> container for this package.
 */

Package.prototype.injectHtml = function (parent) {
	parent = parent || this.parentElements['text/html'];

	return this.injectElement(this.getHtml(), parent);
};


/**
 * Ejects HTML from its parent element
 *
 * @returns {HTMLDivElement}     The ejected element
 */

Package.prototype.ejectHtml = function () {
	return this.ejectElement('text/html');
};


/**
 * Creates (if needed) and injects (if needed) the HTML container for this package into its logical
 * parent, then removes the "display: none" style from the HTML container.
 *
 * @returns {HTMLDivElement}     The visible element
 */

Package.prototype.showHtml = function () {
	var cnt = this.injectHtml();

	cnt.style.display = '';

	return cnt;
};


/**
 * If there is an HTML container, it sets the "display: none" style to hide it.
 *
 * @returns {HTMLDivElement}     The hidden element
 */

Package.prototype.hideHtml = function () {
	var cnt = this.containers['text/html'];

	if (!cnt) {
		return;
	}

	cnt.style.display = 'none';

	return cnt;
};


// ----------------
// CSS specific API
// ----------------

/**
 * Static function to instantiate a package's CSS.
 *
 * @param {string} content  The HTML content
 * @param {string} name     The package name
 * @returns {Element}       A <style> element that contains the given content
 */

Package.createCss = function (content, name) {
	var cnt = document.createElement('style');
	cnt.setAttribute('type', 'text/css');

	if (name) {
		cnt.setAttribute('data-package', name);
		cnt.setAttribute('data-page', name);  // deprecated
	}

	// inject CSS from the package

	if (content) {
		cnt.textContent = content;
	}

	return cnt;
};


/**
 * Creates (if needed) and returns the <style> element for this package.
 *
 * @returns {HTMLStyleElement}  The <style> element for this package.
 */

Package.prototype.getCss = function () {
	var type = 'text/css';
	var cnt = this.containers[type];

	if (!cnt) {
		cnt = Package.createCss(this.claimAllContent('text/css'), this.name);

		this.containers[type] = cnt;
	}

	return cnt;
};


/**
 * Creates (if needed) and injects the <style> element for this package into a given parent.
 *
 * @param {Element}             The parent to append to.
 * @returns {HTMLStyleElement}  The <style> element for this package.
 */

Package.prototype.injectCss = function (parent) {
	parent = parent || this.parentElements['text/css'];

	return this.injectElement(this.getCss(), parent);
};


/**
 * Ejects the <style> element from its parent element
 *
 * @returns {HTMLStyleElement}     The ejected element
 */

Package.prototype.ejectCss = function () {
	return this.ejectElement('text/css');
};
