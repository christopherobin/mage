var mime = require('./mime.js');


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


// Static API for instantiation

Package.prototype.parse = function (data) {
	// parse the data and fill in the package

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

	var parts = data.split(metaData.delimiter);

	for (i = 0, len = parts.length; i < len; i++) {
		var part = parts[i];

		var eol = part.indexOf('\n');
		var contentType = mime.parse(part.substring(0, eol));
		var content = part.substring(eol + 1);

		if (contentType) {
			this.content[contentType.type] = this.content[contentType.type] || [];
			this.content[contentType.type].push(content);
		}
	}

	return metaData;
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


// API

Package.prototype.claimContent = function (type) {
	var list = this.content[type];

	if (!list) {
		return;
	}

	return list.shift();
};


Package.prototype.injectElement = function (type, elm) {
	var parent = this.parentElements[type];

	if (!parent) {
		throw new Error('Please define a parent element for ' + type);
	}

	if (parent !== elm.parentNode) {
		parent.appendChild(elm);
	}

	return elm;
};


Package.prototype.ejectElement = function (type) {
	var elm = this.containers[type];
	if (!elm || !elm.parentNode) {
		return;
	}

	elm.parentNode.removeChild(elm);
	return elm;
};


Package.prototype.destroyElement = function (type) {
	var elm = this.ejectElement(type);
	if (!elm) {
		return;
	}

	delete this.containers[type];
	return elm;
};


Package.prototype.destroy = function () {
	this.destroyElement('text/html');
	this.destroyElement('text/css');

	this.content = {};
};


// JavaScript specific API

Package.prototype.runJs = function () {
	var content = this.claimContent('text/javascript');

	if (content) {
		/*jshint evil:true */
		new Function(content)();
	}
};


// HTML specific API

Package.prototype.getHtml = function () {
	var type = 'text/html';

	var cnt = this.containers[type];

	if (!cnt) {
		cnt = document.createElement('div');
		cnt.className = 'mage-package';
		cnt.setAttribute('data-package', this.name);

		// deprecated attributes

		cnt.className += ' mage-page ';
		cnt.setAttribute('data-page', this.name);

		// start hidden

		cnt.style.display = 'none';

		// inject HTML from the package

		var content = this.claimContent('text/html');
		if (content) {
			cnt.innerHTML = content;
		}

		this.containers[type] = cnt;
	}

	return cnt;
};


Package.prototype.injectHtml = function () {
	return this.injectElement('text/html', this.getHtml());
};


Package.prototype.ejectHtml = function () {
	return this.ejectElement('text/html');
};


Package.prototype.showHtml = function () {
	var cnt = this.injectHtml();

	cnt.style.display = '';

	return cnt;
};


Package.prototype.hideHtml = function () {
	var cnt = this.containers['text/html'];

	if (!cnt) {
		return;
	}

	cnt.style.display = 'none';

	return cnt;
};


// CSS specific API

Package.prototype.getCss = function () {
	var type = 'text/css';
	var cnt = this.containers[type];

	if (!cnt) {
		cnt = document.createElement('style');
		cnt.setAttribute('type', 'text/css');
		cnt.setAttribute('data-package', this.name);

		// deprecated attribute

		cnt.setAttribute('data-page', this.name);

		// inject CSS from the package

		var content = this.claimContent('text/css');

		if (content) {
			cnt.textContent = content;
		}

		this.containers[type] = cnt;
	}

	return cnt;
};


Package.prototype.injectCss = function () {
	return this.injectElement('text/css', this.getCss());
};


Package.prototype.ejectCss = function () {
	return this.ejectElement('text/css');
};
