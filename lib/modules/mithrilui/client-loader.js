window.mui = new function()
{
	var assetMap;
	var htmlClassName = 'mithrilui-page';
	var loadedCbs = {};
	var displayCbs = {};
	var closeCbs = {};
	var error = function(msg) { alert(msg); };
	var displayedPage = null;
	var pageData = {};
	var that = this;

	var baseUrl = window.location.pathname;
	if (baseUrl[baseUrl.length-1] === '/')
	{
		baseUrl = baseUrl.slice(0, -1);
	}


	// package name

	this.packageName = window.location.pathname.substring(window.location.pathname.lastIndexOf('/')+1);


	// page list

	var m = /pages=(.+?)(&|$)/.exec(window.location.hash);
	if (!m || !m[1])
	{
		return error('No page specified.');
	}

	this.pageQueue = decodeURIComponent(m[1]).split(',');


	// session ID

	var m = /session=(.+?)(&|$)/.exec(window.location.hash);
	if (!m || !m[1])
	{
		return error('No session specified.');
	}

	this.session = decodeURIComponent(m[1]);


	// language

	var m = /language=(.+?)(&|$)/.exec(window.location.search);
	if (!m || !m[1])
	{
		this.language = null;
	}
	else
		this.language = decodeURIComponent(m[1]);


	// api

	this.loadPage = function(name)
	{
		var incAssetMap = !assetMap;
		var cacheKey = 'muicache/' + that.packageName + '/' + name + '/' + that.language + '/' + (incAssetMap ? '1' : '0');

		var currentHash, currentPartSplit;

		if (window.localStorage && (cacheKey in window.localStorage))
		{
			var cacheMeta = window.localStorage.getItem(cacheKey + '/meta');
			if (cacheMeta)
			{
				cacheMeta = JSON.parse(cacheMeta);
				if (cacheMeta.hash && cacheMeta.partSplit)
				{
					currentHash = cacheMeta.hash;
					currentPartSplit = cacheMeta.partSplit;
				}
			}
		}

		var xhr = new XMLHttpRequest();

		xhr.onreadystatechange = function() {
			if (xhr.readyState != 4) return;

			if (xhr.status == 0)
			{
				return; // error('No connection, please reload.');
			}

			var data = xhr.responseText;
			if (!data)
			{
				return error('Download failed, please reload.');
			}

			var partSplit;

			if (data.trim() === 'usecache')
			{
				data = window.localStorage.getItem(cacheKey);
				partSplit = currentPartSplit;
			}
			else
			{
				partSplit = xhr.getResponseHeader('X-MithrilUI-PartSplit');

				var hash = xhr.getResponseHeader('X-MithrilUI-Hash');

				// store the data in localStorage

				if (hash && window.localStorage)
				{
					window.localStorage.setItem(cacheKey, data);
					window.localStorage.setItem(cacheKey + '/meta', JSON.stringify({ hash: hash, partSplit: partSplit }));
				}
			}

			var parts = data.split(partSplit);
			var css = '';

			for (var i=0, len = parts.length; i < len; i++)
			{
				var part = parts[i];

				var eol = part.indexOf('\n');
				var mimetype = part.substring(0, eol);
				var content  = part.substring(eol + 1);

				switch (mimetype)
				{
					case 'mui/assetmap':
						assetMap = JSON.parse(content);
						break;

					case 'text/html':
						var cnt = document.createElement('div');
						cnt.className = htmlClassName;
						cnt.setAttribute('data-page', name);
						cnt.innerHTML = content;
						cnt.style.display = 'none';
						document.body.appendChild(cnt);
						break;

					case 'text/javascript':
						var cnt = document.createElement('script');
						cnt.setAttribute('type', mimetype);
						cnt.setAttribute('data-page', name);
						cnt.innerHTML = content;
						document.head.appendChild(cnt);
						break;

					case 'text/css':
						css += content;
						break;
				}
			}

			pageData[name] = {};

			if (css) pageData[name].css = css;

			var cbs = loadedCbs[name];
			if (cbs)
			{
				for (var i=0, len = cbs.length; i < len; i++)
				{
					cbs[i](name);
				}
			}

			if (!displayedPage)
			{
				that.displayPage(name);
			}

			that.loadNextPage();
		};

		var url = baseUrl + '/' + name + '?language=' + that.language;
		if (incAssetMap)
		{
			url += '&assetmap=1';
		}

		if (currentHash)
		{
			url += '&hash=' + encodeURIComponent(currentHash);
		}

		xhr.open('GET', url, true);
		xhr.send(null);
	};


	this.onloaded = function(name, cb)
	{
		if (pageData[name])
		{
			// already loaded
			return cb(name);
		}

		if (name in loadedCbs)
		{
			loadedCbs[name].push(cb);
		}
		else
			loadedCbs[name] = [cb];
	};


	this.ondisplay = function(name, cb)
	{
		if (name in displayCbs)
		{
			displayCbs[name].push(cb);
		}
		else
			displayCbs[name] = [cb];
	};


	this.onclose = function(name, cb)
	{
		if (name in closeCbs)
		{
			closeCbs[name].push(cb);
		}
		else
			closeCbs[name] = [cb];
	};


	this.loadNextPage = function()
	{
		var next = this.pageQueue.shift();
		if (next)
		{
			this.loadPage(next);
		}
	};


	this.displayPage = function(name)
	{
		document.body.scrollIntoView(true);

		var pages = document.getElementsByClassName(htmlClassName);

		var found = false;
		for (var i=0, len = pages.length; i < len; i++)
		{
			var elm = pages[i];

			if (elm.getAttribute('data-page') === name)
			{
				found = elm;
			}

			elm.style.display = 'none';
		}

		if (!found) return;

		if (displayedPage)
		{
			var cbs = closeCbs[displayedPage];
			if (cbs)
			{
				for (var i=0, len = cbs.length; i < len; i++)
				{
					cbs[i](name);
				}
			}

			var displayedCss = document.querySelector('style[data-page="' + displayedPage + '"]');
			if (displayedCss)
			{
				displayedCss.parentNode.removeChild(displayedCss);
			}
		}

		var cbs = displayCbs[name];
		if (cbs)
		{
			for (var i=0, len = cbs.length; i < len; i++)
			{
				cbs[i](name);
			}
		}

		if (pageData[name].css)
		{
			var cnt = document.createElement('style');
			cnt.setAttribute('type', 'text/css');
			cnt.setAttribute('data-page', name);
			cnt.innerHTML = pageData[name].css;
			document.head.appendChild(cnt);
		}

		found.style.display = '';

		displayedPage = name;
	};


	this.img = function(descriptor)
	{
		if (!descriptor || !assetMap) return null;

		var images = assetMap.files.img;
		if (!images || !images.files) return null;

		var path = images.files[descriptor];
		if (!path) return null;

		var descParts;

		path = path.replace(/\$([0-9]+)/g, function(m) {
			if (m[1] == '0') return descriptor;

			if (!descParts) descParts = descriptor.split(assetMap.descriptorDelimiter);

			return descParts[m[1]-1];
		});

		return images.baseUrl + path;
	};


	this.loadNextPage();
};
