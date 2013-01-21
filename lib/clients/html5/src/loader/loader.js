(function (window) {

	var mage = window.mage;

	if (!mage) {
		console.error('MAGE not available.');
		return;
	}

	var mod = mage.loader = new mage.EventEmitter();


	function fatalError() {
		console.error(arguments);
		mod.emit('error');
	}


	mod.pageQueue = [];
	mod.timeout = 30000;
	mod.retryInterval = 1500;

	var htmlClassName = 'mage-page';
	var displayedPage = null;
	var pageData = {};
	var localStorage = window.localStorage;
	var connState = 'online';


	function setOnline(pageName) {
		// called on successful download

		if (connState !== 'online') {
			connState = 'online';
			mod.emit('online', pageName);
		}
	}

	function setOffline(pageName) {
		// called when a page download fails because of connection failure

		if (connState !== 'offline') {
			connState = 'offline';
			mod.emit('offline', pageName);
		}

		// set up an interval and try to download the page again

		window.setTimeout(function () {
			mod.loadPage(pageName);
		}, mod.retryInterval);
	}


	function setMaintenance(pageName, content, mimeType) {
		if (connState !== 'maintenance') {
			connState = 'maintenance';

			mod.emit('maintenance', content, mimeType);
		}

		window.setTimeout(function () {
			mod.loadPage(pageName);
		}, mod.retryInterval);
	}


	function getPageObject(name) {
		var page = pageData[name];

		if (!page) {
			console.warn('Page', name, 'not available.');
			return null;
		}

		return page;
	}


	// api

	mod.setup = function (pages) {
		mod.pageQueue = pages;
	};


	function renderHtml(pageName, content) {
		var cnt = document.createElement('div');
		cnt.className = htmlClassName;
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


	mod.getDownloadedParts = function (mimetype, pageName) {
		var result = [], page;

		if (pageName) {
			page = getPageObject(pageName);
			if (page && (mimetype in page.unknown)) {
				result = page.unknown[mimetype];
			}
		} else {
			for (var name in pageData) {
				page = pageData[name];

				if (mimetype in page.unknown) {
					result = result.concat(page.unknown[mimetype]);
				}
			}
		}

		return result;
	};


	mod.loadedPage = function (name, data, cacheKey, cachedHeader) {
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

		pageData[name] = page;


		// run the javascript part immediately

		if (page.js) {
			renderJs(name, page.js);
			delete page.js;
		}

		mod.emit(name + '.loaded');
	};


	mod.loadPage = function (name) {
		var cacheKey = [
			'pagecache',
			mage.appName,
			name,
			mage.getLanguage(),
			mage.getDensity()
		].join('/');
		var cachedHeader;

		if (localStorage && (cacheKey in localStorage)) {
			var headerData = localStorage.getItem(cacheKey + '/header');

			if (headerData) {
				try {
					cachedHeader = JSON.parse(headerData);
				} catch (e) {
					return fatalError('Header parse error', e, headerData);
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

				if (mod.listeners('maintenance').length > 0) {
					return setMaintenance(name, data, mimetype);
				}

				// if the content is a mage page, we treat it as a successful download

				if (mimetype.indexOf('text/magepage') === 0) {
					code = 200;
				}

				// else: consider offline
			}

			if (code !== 200 || !data) {
				return setOffline(name);
			}

			setOnline(name);

			mod.loadedPage(name, data, cacheKey, cachedHeader);

			mod.loadNextPage();
		};

		var hash = cachedHeader && cachedHeader.hash && encodeURIComponent(cachedHeader.hash) || '';
		var appName = mage.appName;
		var language = mage.getLanguage();
		var screen = window.screen.width + 'x' + window.screen.height;
		var density = mage.getDensity();

		var baseUrl = mage.getClientHostBaseUrl(true);
		var url = baseUrl.protocol + '://' + baseUrl.host + ':' + baseUrl.port + '/app/' + appName + '/' + name + '?language=' + language + '&screen=' + screen + '&density=' + density;

		if (hash) {
			url += '&hash=' + hash;
		}

		timer = window.setTimeout(
			function () {
				aborting = true;
				xhr.abort();
				timer = null;
				setOffline(name);
			},
			mod.timeout
		);

		xhr.open('GET', url, true);
		xhr.setRequestHeader('Cache-Control', 'no-cache');

		if (baseUrl.authUser && baseUrl.authPass) {
			xhr.setRequestHeader('Authorization', 'Basic ' + window.btoa(baseUrl.authUser + ':' + baseUrl.authPass));
		}

		xhr.send(null);
	};


	mod.loadNextPage = function () {
		var next = mod.pageQueue.shift();
		if (next) {
			mod.loadPage(next);
		}
	};


	mod.loadPages = function (pages) {
		mod.pageQueue = mod.pageQueue.concat(pages);
		mod.loadNextPage();
	};


	mod.start = function () {
		mod.loadNextPage();
	};


	var pageNodes = document.getElementsByClassName(htmlClassName);	// page lookup nodelist

	function getPageHtml(name) {
		for (var i = 0, len = pageNodes.length; i < len; i++) {
			var elm = pageNodes[i];

			if (elm.getAttribute('data-page') === name) {
				return elm;
			}
		}

		return null;
	}


	mod.getPage = getPageHtml;


	mod.getDisplayedPage = function () {
		if (displayedPage) {
			return getPageHtml(displayedPage);
		}

		return null;
	};


	mod.renderPage = function (name) {
		var page = getPageObject(name);

		if (!page) {
			return;
		}

		// HTML:
		// if the page is not yet in the document, apply the asset map to our html and inject it into the document
		// we can then forget about the original html data, since it will remain in the document

		var found = getPageHtml(name);

		if (!found && typeof page.html === 'string') {
			var content = mage.assets ? mage.assets.applyAssetMapToContent(page.html) : page.html;

			found = renderHtml(name, content);
			delete page.html;
		}

		return found;
	};


	mod.displayPage = function (name) {
		var page = getPageObject(name);

		if (!page) {
			mod.emit('error');
			return;
		}

		var found = mod.renderPage(name);

		// CSS:
		// remove the css of the currently displayed page

		if (displayedPage) {
			// emit close event

			mod.emit(displayedPage + '.close');

			var displayedCss = document.querySelector('style[data-page="' + displayedPage + '"]');
			if (displayedCss) {
				displayedCss.parentNode.removeChild(displayedCss);
			}
		}

		// scroll to top

		document.body.scrollIntoView(true);

		// apply the asset map to our css and inject the result into the document

		var content = mage.assets ? mage.assets.applyAssetMapToContent(page.css) : page.css;

		renderCss(name, content);

		displayedPage = name;

		// hide all other pages

		for (var i = 0, len = pageNodes.length; i < len; i++) {
			var elm = pageNodes[i];

			if (elm !== found) {
				elm.style.display = 'none';
			}
		}

		// display current page

		found.style.display = '';

		// emit display event

		mod.emit(displayedPage + '.display');
	};

}(window));
