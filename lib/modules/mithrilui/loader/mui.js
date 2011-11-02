(function () {

	if (!window.mithril) {
		window.mithril = {};
	}

	var mithril = window.mithril;

	var mod = {
		language: 'EN',
		baseUrl: '',
		packageName: '',
		pageQueue: []
	};

	mithril.mui = mod;

	var htmlClassName = 'mithrilui-page';
	var loadedCbs = {};
	var displayCbs = {};
	var closeCbs = {};
	var displayedPage = null;
	var pageData = {};

	function error(msg) {
		alert(msg);
	}


	// api

	mod.setup = function (language, baseUrl, packageName, pages) {
		if (baseUrl && baseUrl[baseUrl.length - 1] === '/') {
			baseUrl = baseUrl.slice(0, -1);
		}

		mod.language = language || mod.language;
		mod.baseUrl = baseUrl || '';
		mod.packageName = packageName;
		mod.pageQueue = pages;
	};


	function renderHtml(pageName, content) {
		var cnt = document.createElement('div');
		cnt.className = htmlClassName;
		cnt.setAttribute('data-page', pageName);
		cnt.innerHTML = content;
		cnt.style.display = 'none';
		document.body.appendChild(cnt);
		return cnt;
	}


	function renderCss(pageName, content) {
		var cnt = document.createElement('style');
		cnt.setAttribute('type', 'text/css');
		cnt.setAttribute('data-page', pageName);
		cnt.innerHTML = content;
		document.head.appendChild(cnt);
		return cnt;
	}


	function renderJs(pageName, content) {
		var cnt = document.createElement('script');
		cnt.setAttribute('type', 'text/javascript');
		cnt.setAttribute('data-page', pageName);
		cnt.innerHTML = content;
		document.head.appendChild(cnt);
		return cnt;
	}


	var assetMapRequired = true;

	mod.loadPage = function (name) {
		var cacheKey = 'muicache/' + mod.packageName + '/' + name + '/' + mod.language + '/' + (assetMapRequired ? '1' : '0');

		var currentHash, currentPartSplit;
		var localStorage = window.localStorage;

		if (localStorage && (cacheKey in localStorage)) {
			var cacheMeta = localStorage.getItem(cacheKey + '/meta');

			if (cacheMeta) {
				cacheMeta = JSON.parse(cacheMeta);

				if (cacheMeta.hash && cacheMeta.partSplit) {
					currentHash = cacheMeta.hash;
					currentPartSplit = cacheMeta.partSplit;
				}
			}
		}

		var xhr = new XMLHttpRequest();

		xhr.onreadystatechange = function () {
			if (xhr.readyState !== 4) {
				return;
			}

			if (xhr.status === 0) {
				return; // error('No connection, please reload.');
			}

			var data = xhr.responseText;
			if (!data) {
				return error('Download failed, please reload.');
			}

			var partSplit;

			if (data.trim() === 'usecache') {
				data = localStorage.getItem(cacheKey);
				partSplit = currentPartSplit;
			} else {
				partSplit = xhr.getResponseHeader('X-MithrilUI-PartSplit');

				var hash = xhr.getResponseHeader('X-MithrilUI-Hash');

				// store the data in localStorage

				if (hash && localStorage) {
					localStorage.setItem(cacheKey, data);
					localStorage.setItem(cacheKey + '/meta', JSON.stringify({ hash: hash, partSplit: partSplit }));
				}
			}

			var parts = data.split(partSplit);
			var page = { css: '', html: '', js: '' };

			var cnt, assetMap;

			for (var i = 0, len = parts.length; i < len; i++) {
				var part = parts[i];

				var eol = part.indexOf('\n');
				var mimetype = part.substring(0, eol);
				var content  = part.substring(eol + 1);

				switch (mimetype) {
				case 'mui/assetmap':
					assetMapRequired = false;
					assetMap = JSON.parse(content);
					break;

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
					console.warn('Unknown mimetype', mimetype);
					break;
				}
			}


			// handle the page data

			pageData[name] = page;


			// handle a potentially received asset map

			if (page.js) {
				renderJs(name, page.js);
				delete page.js;
			}

			var cbs = loadedCbs[name];
			if (cbs) {
				for (var i = 0, len = cbs.length; i < len; i++) {
					cbs[i](name);
				}
			}

			if (assetMap) {
				mithril.assets.init(assetMap);
			}

			mod.loadNextPage();
		};

		var url = mod.baseUrl + '/' + name + '?language=' + mod.language;
		if (assetMapRequired) {
			url += '&assetmap=1';
		}

		if (currentHash) {
			url += '&hash=' + encodeURIComponent(currentHash);
		}

		xhr.open('GET', url, true);
		xhr.setRequestHeader('Cache-Control', 'no-cache');
		xhr.send(null);
	};


	mod.onloaded = function (name, cb) {
		if (pageData[name]) {
			// the page has already been loaded

			return cb(name);
		}

		if (name in loadedCbs) {
			loadedCbs[name].push(cb);
		} else {
			loadedCbs[name] = [cb];
		}
	};


	mod.ondisplay = function (name, cb) {
		if (name in displayCbs) {
			displayCbs[name].push(cb);
		} else {
			displayCbs[name] = [cb];
		}
	};


	mod.onclose = function (name, cb) {
		if (name in closeCbs) {
			closeCbs[name].push(cb);
		} else {
			closeCbs[name] = [cb];
		}
	};


	mod.loadNextPage = function () {
		var next = mod.pageQueue.shift();
		if (next) {
			mod.loadPage(next);
		}
	};


	mod.start = function () {
		mod.loadNextPage();
	};


	mod.displayPage = function (name) {
		var page = pageData[name];
		if (!page) {
			console.warn('Page ', name, 'not available for display.');
			return;
		}

		// HTML:
		// if the page is not yet in the document, apply the asset map to our html and inject it into the document
		// we can then forget about the original html data, since it will remain in the document

		var pageNodes = document.getElementsByClassName(htmlClassName);

		var found = false;
		for (var i = 0, len = pageNodes.length; i < len; i++) {
			var elm = pageNodes[i];

			if (elm.getAttribute('data-page') === name) {
				found = elm;
			} else {
				elm.style.display = 'none';
			}
		}

		if (!found) {
			found = renderHtml(name, mithril.assets.applyAssetMapToContent(page.html));
			delete page.html;

		}

		// CSS:
		// remove the css of the currently displayed page

		if (displayedPage) {
			// emit close event

			cbs = closeCbs[displayedPage];
			if (cbs) {
				for (i = 0, len = cbs.length; i < len; i++) {
					cbs[i](name);
				}
			}

			// TODO: doesn't a documentFragment make more sense here?

			var displayedCss = document.querySelector('style[data-page="' + displayedPage + '"]');
			if (displayedCss) {
				displayedCss.parentNode.removeChild(displayedCss);
			}
		}

		// scroll to top

		document.body.scrollIntoView(true);

		// apply the asset map to our css and inject the result into the document

		renderCss(name, mithril.assets.applyAssetMapToContent(page.css));

		displayedPage = name;

		found.style.display = '';

		// emit display event

		var cbs;

		cbs = displayCbs[name];
		if (cbs) {
			for (i = 0, len = cbs.length; i < len; i++) {
				cbs[i](name);
			}
		}
	};

}());
