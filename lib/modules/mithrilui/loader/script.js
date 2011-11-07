(function () {

	function MithrilAssets() {

		var that = this;
		var assets = [];
		var assetsByIdent = {};
		var assetsHandler;


		// asset prototype

		function Asset(context, ident, delimiter, baseUrl, relPath, version, language) {
			var parts = ident.split(delimiter);

			relPath = relPath.replace(/\$([0-9]+)/g, function (m) {
				return (m[1] === '0') ? ident : parts[m[1] - 1];
			});

			this.fullIdent = context + '/' + ident;
			this.baseUrl = baseUrl;
			this.relPath = relPath;
			this.version = version || '1';
			this.language = language || null;
		}


		Asset.prototype.getUrl = function () {
			if (this.url) {
				return window.encodeURI(this.url);
			}

			return window.encodeURI(this.baseUrl + this.relPath) + '?v' + this.version;
		};


		Asset.prototype.overrideUrl = function (url) {
			this.url = url;
		};


		this.getAsset = function (ident) {
			return assetsByIdent[ident] || null;
		};


		this.get = function (ident) {
			var asset = assetsByIdent[ident];

			if (asset) {
				return asset.getUrl();
			}

			console.warn('Asset', ident, 'not found.');
			return '';
		};


		this.getAll = function () {
			return assets;
		};


		this.getAllByIdent = function () {
			return assetsByIdent;
		};


		this.applyAssetMapToContent = function (content) {
			return content.replace(/mui:\/\/(\w+)\/([\/\w\-]+)/g, function (uri) {
				return that.get(uri.substring(6));
			});
		};


		function registerContextualLookup(context) {
			if (context in that) {
				console.warn('Tried to register ' + context + ' as a contextual lookup, but key already existed.');
				return;
			}

			that[context] = function (ident) {
				return that.get(context + '/' + ident);
			};
		}


		this.registerAssetsHandler = function (handler) {
			assetsHandler = handler;
		};


		this.init = function (assetMap, cb) {
			var that = this;

			// create asset objects

			var delimiter = assetMap.descriptorDelimiter;

			// create assets for each entry

			for (var context in assetMap.assets) {
				// register a quick lookup function for this context

				registerContextualLookup(context);

				// register assets

				var baseUrl = assetMap.assets[context].baseUrl;
				var map = assetMap.assets[context].map;

				for (var ident in map) {
					var entry = map[ident].split('\t');	// relPath, version, (language)
					var relPath = entry[0];
					var version = entry[1];
					var language = entry[2] || null;

					var asset = new Asset(context, ident, delimiter, baseUrl, relPath, version, language);

					assets.push(asset);
					assetsByIdent[asset.fullIdent] = asset;
				}
			}

			// if the wizAssets plugin is installed, let it do its magic

			if (assetsHandler) {
				assetsHandler.run(this, cb);
			} else {
				cb();
			}
		};
	}


	function MithrilUi() {
		this.language = 'EN';
		this.baseUrl = '';
		this.packageName = '';
		this.pageQueue = [];

		var htmlClassName = 'mithrilui-page';
		var loadedCbs = {};
		var displayCbs = {};
		var closeCbs = {};
		var displayedPage = null;
		var pageData = {};
		var that = this;

		var error = function (msg) {
			alert(msg);
		};


		// api

		this.setup = function (language, baseUrl, packageName, pages) {
			if (baseUrl && baseUrl[baseUrl.length - 1] === '/') {
				baseUrl = baseUrl.slice(0, -1);
			}

			this.language = language || this.language;
			this.baseUrl = baseUrl || '';
			this.packageName = packageName;
			this.pageQueue = pages;
		};


		function renderHtml(pageName, content) {
			var cnt = document.createElement('div');
			cnt.className = htmlClassName;
			cnt.setAttribute('data-page', pageName);
			cnt.innerHTML = content;
			cnt.style.display = 'none';
			document.body.appendChild(cnt);
		}


		function renderCss(pageName, content) {
			var cnt = document.createElement('style');
			cnt.setAttribute('type', 'text/css');
			cnt.setAttribute('data-page', pageName);
			cnt.innerHTML = content;
			document.head.appendChild(cnt);
		}


		function renderJs(pageName, content) {
			var cnt = document.createElement('script');
			cnt.setAttribute('type', 'text/javascript');
			cnt.setAttribute('data-page', pageName);
			cnt.innerHTML = content;
			document.head.appendChild(cnt);
		}


		var assetMapRequired = true;

		this.loadPage = function (name) {
			var cacheKey = 'muicache/' + that.packageName + '/' + name + '/' + that.language + '/' + (assetMapRequired ? '1' : '0');

			var currentHash, currentPartSplit;

			if (window.localStorage && (cacheKey in window.localStorage)) {
				var cacheMeta = window.localStorage.getItem(cacheKey + '/meta');

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
					data = window.localStorage.getItem(cacheKey);
					partSplit = currentPartSplit;
				} else {
					partSplit = xhr.getResponseHeader('X-MithrilUI-PartSplit');

					var hash = xhr.getResponseHeader('X-MithrilUI-Hash');

					// store the data in localStorage

					if (hash && window.localStorage) {
						window.localStorage.setItem(cacheKey, data);
						window.localStorage.setItem(cacheKey + '/meta', JSON.stringify({ hash: hash, partSplit: partSplit }));
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

				function nextStep() {
					page.html = window.mithril.assets.applyAssetMapToContent(page.html);
					page.css  = window.mithril.assets.applyAssetMapToContent(page.css);

					if (page.html) {
						renderHtml(name, page.html);
						delete page.html;
					}

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

					if (!displayedPage) {
						that.displayPage(name);
					}

					that.loadNextPage();
				}

				if (assetMap) {
					window.mithril.assets.init(assetMap, function () {
						nextStep();
					});
				} else {
					nextStep();
				}
			};

			var url = that.baseUrl + '/' + name + '?language=' + that.language;
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


		this.onloaded = function (name, cb) {
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


		this.ondisplay = function (name, cb) {
			if (name in displayCbs) {
				displayCbs[name].push(cb);
			} else {
				displayCbs[name] = [cb];
			}
		};


		this.onclose = function (name, cb) {
			if (name in closeCbs) {
				closeCbs[name].push(cb);
			} else {
				closeCbs[name] = [cb];
			}
		};


		this.loadNextPage = function () {
			var next = this.pageQueue.shift();
			if (next) {
				this.loadPage(next);
			}
		};


		this.start = function () {
			this.loadNextPage();
		};


		this.displayPage = function (name) {
			document.body.scrollIntoView(true);

			var pages = document.getElementsByClassName(htmlClassName);

			var found = false;
			for (var i = 0, len = pages.length; i < len; i++) {
				var elm = pages[i];

				if (elm.getAttribute('data-page') === name) {
					found = elm;
				} else {
					elm.style.display = 'none';
				}
			}

			if (!found) {
				return;
			}

			var cbs;

			if (displayedPage) {
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

			cbs = displayCbs[name];
			if (cbs) {
				for (i = 0, len = cbs.length; i < len; i++) {
					cbs[i](name);
				}
			}

			if (pageData[name].css) {
				renderCss(name, pageData[name].css);
			}

			found.style.display = '';

			displayedPage = name;
		};
	}


	var mithril = window.mithril = {};

	mithril.origin = 'http://$cfg(server.clientHost.expose.host):$cfg(server.clientHost.expose.port)';

	mithril.assets = new MithrilAssets();

	if (window.WizAssetsHandler) {
		mithril.assets.registerAssetsHandler(new window.WizAssetsHandler());
	}

	mithril.mui = new MithrilUi();

}());
