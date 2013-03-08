var EventEmitter = require('emitter');
var inherits = require('inherit');

var HTML_CLASS_NAME = 'mage-page';

var Loader = function () {
	this.pageData = {};
	EventEmitter.call(this);
};

inherits(Loader, EventEmitter);

var pageQueue = [];
var pageData = {};
var displayedPage = null;

var timeout = 30000;
var retryInterval = 1500;

var connState = 'online';

var mageConfig = null;
var assetsModule = null;
var language = 'en';
var density = 1;
var pageName;


function setOnline(loader, pageName) {
	// called on successful download

	if (connState !== 'online') {
		connState = 'online';
		loader.emit('online', pageName);
	}
}

function setOffline(loader, pageName) {
	// called when a page download fails because of connection failure

	if (connState !== 'offline') {
		connState = 'offline';
		loader.emit('offline', pageName);
	}

	// set up an interval and try to download the page again

	window.setTimeout(function () {
		loader.loadPage(pageName);
	}, retryInterval);
}


function setMaintenance(loader, pageName, content, mimeType) {
	if (connState !== 'maintenance') {
		connState = 'maintenance';

		loader.emit('maintenance', content, mimeType);
	}

	window.setTimeout(function () {
		loader.loadPage(pageName);
	}, retryInterval);
}


function getPageObject(loader, name) {
	var page = loader.pageData[name];

	if (!page) {
		console.warn('Page', name, 'not available.');
		return null;
	}

	return page;
}


function renderHtml(pageName, content) {
	var cnt = document.createElement('div');
	cnt.className = HTML_CLASS_NAME;
	cnt.setAttribute('data-page', pageName);
	cnt.style.display = 'none';

	if (content) {
		cnt.innerHTML = content;
	}

	document.body.appendChild(cnt);
	return cnt;
}


function renderCss(pageName, content) {
	var cnt = document.createElement('style');
	cnt.setAttribute('type', 'text/css');
	cnt.setAttribute('data-page', pageName);

	if (content) {
		cnt.innerHTML = content;
	}

	document.head.appendChild(cnt);
	return cnt;
}


function renderJs(pageName, content) {
	var cnt = document.createElement('script');
	cnt.setAttribute('type', 'text/javascript');
	cnt.setAttribute('data-page', pageName);

	if (content) {
		cnt.innerHTML = content;
	}

	document.head.appendChild(cnt);
	return cnt;
}


// api

Loader.prototype.configure = function (cfg) {
	if (!cfg) {
		throw new ReferenceError('Missing config.');
	}

	mageConfig = cfg;
	language = cfg.appVariants.languages[0];
	density = cfg.appVariants.densities[0];
	pageName = cfg.pageName;
};


Loader.prototype.registerAssetsModule = function (o) {
	assetsModule = o;
};


Loader.prototype.registerConfigChangeListeners = function (src) {
	var that = this;
	src.on('densityChanged', function (newDensity) {
		that.setDensity(newDensity);
	});
	src.on('languageChanged', function (newLanguage) {
		that.setLanguage(newLanguage);
	});
};


Loader.prototype.setLanguage = function (newLanguage) {
	if (mageConfig.appVariants.languages.indexOf(newLanguage.toLowerCase()) === -1) {
		return;
	}

	language = newLanguage;
};


Loader.prototype.setDensity = function (newDensity) {
	if (mageConfig.appVariants.languages.indexOf(newDensity) === -1) {
		return;
	}

	density = newDensity;
};


Loader.prototype.addPages = function (pages) {
	pageQueue = pages;
};


Loader.prototype.getDownloadedParts = function (mimetype, pageName) {
	var result = [], page;

	if (pageName) {
		page = getPageObject(this, pageName);
		if (page && (mimetype in page.unknown)) {
			result = page.unknown[mimetype];
		}
	} else {
		for (var name in pageData) {
			page = this.pageData[name];

			if (mimetype in page.unknown) {
				result = result.concat(page.unknown[mimetype]);
			}
		}
	}

	return result;
};


Loader.prototype.loadedPage = function (name, data, cacheKey, cachedHeader) {
	// check if we can use our cached version

	var header, i, len;

	if (cacheKey && cachedHeader && data.substr(0, 8) === 'usecache') {
		// use cached version

		header = cachedHeader;
		data = localStorage.getItem(cacheKey);
	} else {
		// pull out the header

		header = {};

		var index = data.indexOf('\n\n');
		if (index !== -1) {
			var lines = data.substring(0, index).split('\n');
			data = data.substring(index + 2);

			for (i = 0, len = lines.length; i < len; i++) {
				var line = lines[i].split(':');

				var key = line.shift().trim().toLowerCase();
				var value = line.join(':').trim();

				header[key] = value;
			}
		}

		// store the data and the header in localStorage

		if (localStorage) {
			try {
				localStorage.setItem(cacheKey, data);
				try {
					localStorage.setItem(cacheKey + '/header', JSON.stringify(header));
				} catch (e) {
					localStorage.removeItem(cacheKey);
				}
			} catch (ignored) {
				// Nothing was put into local storage
			}
		}
	}

	var parts = data.split(header.delimiter);
	var page = { css: '', html: '', js: '', unknown: {} };

	for (i = 0, len = parts.length; i < len; i++) {
		var part = parts[i];

		var eol = part.indexOf('\n');
		var mimetype = part.substring(0, eol).split(';')[0];  // ignore charset, assume utf8
		var content  = part.substring(eol + 1);

		switch (mimetype) {
		case 'text/html':
			page.html = content;
			break;

		case 'text/javascript':
			page.js = content;
			break;

		case 'text/css':
			page.css = content;
			break;

		default:
			if (mimetype in page.unknown) {
				page.unknown[mimetype].push(content);
			} else {
				page.unknown[mimetype] = [content];
			}
			break;
		}
	}


	// handle the page data

	this.pageData[name] = page;


	// run the javascript part immediately

	if (page.js) {
		renderJs(name, page.js);
		delete page.js;
	}

	this.emit(name + '.loaded');
};


Loader.prototype.loadPage = function (name) {
	var that = this;

	var cacheKey = [
		'pagecache',
		mageConfig.appName,
		name,
		language,
		density,
		pageName
	].join('/');

	var cachedHeader;

	if (localStorage && (cacheKey in localStorage)) {
		var headerData = localStorage.getItem(cacheKey + '/header');

		if (headerData) {
			try {
				cachedHeader = JSON.parse(headerData);
			} catch (e) {
				console.error('Header parse error', e, headerData);
				return this.emit('error');
			}
		}
	}

	var xhr = new XMLHttpRequest();
	var timer, aborting = false;

	xhr.onreadystatechange = function () {
		if (xhr.readyState !== 4 || aborting) {
			return;
		}

		if (timer) {
			window.clearTimeout(timer);
			timer = null;
		}

		var code = xhr.status;
		var data = xhr.responseText;
		var mimetype = xhr.getResponseHeader('content-type') || '';

		if (code >= 500 && code < 600) {
			// maintenance mode
			// if the content is managed by the developer, we let him do that

			if (that.listeners('maintenance').length > 0) {
				return setMaintenance(name, data, mimetype);
			}

			// if the content is a mage page, we treat it as a successful download

			if (mimetype.indexOf('text/magepage') === 0) {
				code = 200;
			}

			// else: consider offline
		}

		if (code !== 200 || !data) {
			return setOffline(that, name);
		}

		setOnline(that, name);

		that.loadedPage(name, data, cacheKey, cachedHeader);

		that.loadNextPage();
	};

	var hash = cachedHeader && cachedHeader.hash && encodeURIComponent(cachedHeader.hash) || '';
	
	var appName = mageConfig.appName;

	var screen = window.screen.width + 'x' + window.screen.height;

	var baseUrl = mageConfig.clientHostBaseUrl;

	var url = baseUrl.protocol + '://' + baseUrl.host + ':' + baseUrl.port + '/app/' + appName + '/' + name + '?language=' + language + '&screen=' + screen + '&density=' + density;

	if (pageName) {
		url += '&pageName=' + pageName;
	}

	if (hash) {
		url += '&hash=' + hash;
	}

	timer = window.setTimeout(
		function () {
			aborting = true;
			xhr.abort();
			timer = null;
			setOffline(that, name);
		},
		timeout
	);

	xhr.open('GET', url, true);
	xhr.setRequestHeader('Cache-Control', 'no-cache');

	if (baseUrl.authUser && baseUrl.authPass) {
		xhr.setRequestHeader('Authorization', 'Basic ' + window.btoa(baseUrl.authUser + ':' + baseUrl.authPass));
	}

	xhr.send(null);
};


Loader.prototype.loadNextPage = function () {
	var next = pageQueue.shift();
	if (next) {
		this.loadPage(next);
	}
};


Loader.prototype.loadPages = function (pages) {
	pageQueue = pageQueue.concat(pages);
	this.loadNextPage();
};


Loader.prototype.start = function () {
	this.loadNextPage();
};


Loader.prototype.getPage = function (name) {
	var pageNodes = document.getElementsByClassName(HTML_CLASS_NAME);

	for (var i = 0, len = pageNodes.length; i < len; i++) {
		var elm = pageNodes[i];

		if (elm.getAttribute('data-page') === name) {
			return elm;
		}
	}

	return null;
};


Loader.prototype.getDisplayedPage = function () {
	if (displayedPage) {
		return this.getPage(displayedPage);
	}

	return null;
};


Loader.prototype.renderPage = function (name) {
	var page = getPageObject(this, name);

	if (!page) {
		return;
	}

	// HTML:
	// if the page is not yet in the document, apply the asset map to our html and inject it into the document
	// we can then forget about the original html data, since it will remain in the document

	var found = this.getPage(name);

	if (!found && typeof page.html === 'string') {
		var content = assetsModule ? assetsModule.applyAssetMapToContent(page.html) : page.html;

		found = renderHtml(name, content);
		delete page.html;
	}

	return found;
};


Loader.prototype.displayPage = function (name) {
	var page = getPageObject(this, name);

	if (!page) {
		this.emit('error');
		return;
	}

	var found = this.renderPage(name);

	// CSS:
	// remove the css of the currently displayed page

	if (displayedPage) {
		// emit close event

		this.emit(displayedPage + '.close');

		var displayedCss = document.querySelector('style[data-page="' + displayedPage + '"]');
		if (displayedCss) {
			displayedCss.parentNode.removeChild(displayedCss);
		}
	}

	// scroll to top

	document.body.scrollIntoView(true);

	// apply the asset map to our css and inject the result into the document

	var content = assetsModule ? assetsModule.applyAssetMapToContent(page.css) : page.css;

	renderCss(name, content);

	displayedPage = name;

	// hide all other pages

	var pageNodes = document.getElementsByClassName(HTML_CLASS_NAME);

	for (var i = 0, len = pageNodes.length; i < len; i++) {
		var elm = pageNodes[i];

		if (elm !== found) {
			elm.style.display = 'none';
		}
	}

	// display current page

	found.style.display = '';

	// emit display event

	this.emit(displayedPage + '.display');
};

var loader = new Loader();

module.exports = loader;