var mimeTypes = {
	'text/html': 'html',
	'text/javascript': 'js',
	'text/css': 'css'
};


function Package(name) {
	this.name = name;

	// the original strings representing the content
	// they are automatically cleaned up when possible to preserve memory

	this.content = {
		css: null,
		html: null,
		js: null,
		unknown: {}
	};

	// the style and div tags

	this.containers = {
		css: null,
		html: null
	};

	// where to inject style and div tags

	this.parentElements = {
		html: document.body,
		css: document.head
	};
}

module.exports = Package;


Package.prototype.parse = function (data) {
	// parse the data and fill in the package

	var i, len;

	this.metaData = {};

	var index = data.indexOf('\n\n');
	if (index !== -1) {
		var lines = data.substring(0, index).split('\n');
		data = data.substring(index + 2);

		for (i = 0, len = lines.length; i < len; i++) {
			var line = lines[i].split(':');

			var key = line.shift().trim().toLowerCase();
			var value = line.join(':').trim();

			this.metaData[key] = value;
		}
	}

	var parts = data.split(this.metaData.delimiter);

	for (i = 0, len = parts.length; i < len; i++) {
		var part = parts[i];

		var eol = part.indexOf('\n');
		var mimeType = part.substring(0, eol).split(';')[0];  // ignore charset, assume utf8
		var content  = part.substring(eol + 1);

		var type = mimeTypes[mimeType]; // html, css, js

		if (type) {
			this.content[type] = content;
		} else {
			this.content.unknown[mimeType] = this.content.unknown[mimeType] || [];
			this.content.unknown[mimeType].push(content);
		}
	}
};


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


Package.fromCache = function (name, cache, cb) {
	cache.getData(name, function (error, data) {
		if (error) {
			return cb(error);
		}

		return Package.fromData(name, data, null, cb);
	});
};


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


Package.prototype.runJs = function () {
	if (this.content.js) {
		/*jshint evil:true */
		new Function(this.content.js)();

		// claim back memory
		this.content.js = null;
	}
};


Package.prototype.getHtml = function () {
	if (this.containers.html) {
		return this.containers.html;
	}

	var cnt = document.createElement('div');
	cnt.className = 'mage-package';
	cnt.setAttribute('data-package', this.name);

	// deprecated attributes

	cnt.className += ' mage-page ';
	cnt.setAttribute('data-page', this.name);

	// start hidden

	cnt.style.display = 'none';

	// inject HTML from the package

	if (this.content.html) {
		cnt.innerHTML = this.content.html;
		this.content.html = null;
	}

	this.containers.html = cnt;

	return cnt;
};


Package.prototype.injectHtml = function () {
	var parent = this.parentElements.html;

	if (!parent) {
		throw new Error('Please define a parent element for HTML');
	}

	var cnt = this.getHtml();

	if (parent !== cnt.parentNode) {
		parent.appendChild(cnt);
	}

	return cnt;
};


Package.prototype.showHtml = function () {
	var cnt = this.injectHtml();

	cnt.style.display = '';

	return cnt;
};


Package.prototype.hideHtml = function () {
	var cnt = this.containers.html;

	if (!cnt) {
		return;
	}

	cnt.style.display = 'none';

	return cnt;
};


Package.prototype.getCss = function () {
	if (this.containers.css) {
		return this.containers.css;
	}

	var cnt = document.createElement('style');
	cnt.setAttribute('type', 'text/css');
	cnt.setAttribute('data-package', this.name);

	// deprecated attribute

	cnt.setAttribute('data-page', this.name);

	// inject CSS from the package

	if (this.content.css) {
		cnt.textContent = this.content.css;
		this.content.css = null;
	}

	this.containers.css = cnt;

	return cnt;
};


Package.prototype.injectCss = function () {
	var parent = this.parentElements.css;

	if (!parent) {
		throw new Error('Please define a parent element for CSS');
	}

	var cnt = this.getCss();

	if (parent !== cnt.parentNode) {
		parent.appendChild(cnt);
	}
};


Package.prototype.ejectCss = function () {
	var elm = this.containers.css;
	if (elm) {
		elm.parentNode.removeChild(elm);
	}
};


Package.prototype.destroy = function () {
	this.content.html = null;
	this.content.css = null;
	this.content.js = null;
	this.unknown = null;

	var cnt = this.containers;

	if (cnt.html) {
		if (cnt.html.parentNode) {
			cnt.html.parentNode.removeChild(cnt.html);
		}

		cnt.html = null;
	}

	if (cnt.css) {
		if (cnt.css.parentNode) {
			cnt.css.parentNode.removeChild(cnt.css);
		}

		cnt.css = null;
	}
};
