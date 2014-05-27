var mage = require('mage');
var mageLoader = require('loader');


function Sidebar(parent) {
	this.currentPage = null;
	this.loaded = false;
	this.buttonMap = {};
	this.pageWidgetMap = {};

	var that = this;
	var s;

	// sidebar container

	this.sidebar = document.createElement('nav');
	s = this.sidebar.style;

	s.display = 'none';
	s.position = 'fixed';
	s.top = '0';
	s.bottom = '0';
	s.width = '200px';
	s.background = '#f2f2f2';
	s.overflowY = 'auto';

	// logo

	this.logo = document.createElement('div');
	s = this.logo.style;

	s.backgroundImage = 'url(\'' + mage.assets.img('mage_logo_white_font') + '\')';
	s.backgroundSize = 'contain';
	s.backgroundColor = '#393939';
	s.backgroundRepeat = 'no-repeat';
	s.backgroundPosition = 'center';
	s.position = 'relative';
	s.height = '120px';

	// spinner

	var style = document.createElement('style');
	style.rel = 'stylesheet';
	style.type = 'text/css';
	style.textContent =
		'@-webkit-keyframes pulse { from { opacity: 0 }, to { opacity: 1 } }\n' +
		'@keyframes pulse { from { opacity: 0 }, to { opacity: 1 } }';

	document.getElementsByTagName('head')[0].appendChild(style);

	var spinner = document.createElement('div');
	spinner.style.position = 'absolute';
	spinner.style.height = '14px';
	spinner.style.bottom = '8px';
	spinner.style.width = '100%';
	spinner.style.textAlign = 'center';
	spinner.style.display = 'none';

	var dotCount = 3;
	for (var i = 0; i < dotCount; i++) {
		var timeOffset = Math.round((dotCount - 1 - i) * 1000 / dotCount) + 'ms';

		var dot = document.createElement('div');
		dot.style.display = 'inline-block';
		dot.style.width = '8px';
		dot.style.height = '8px';
		dot.style.borderRadius = '4px';
		dot.style.margin = '0 6px';
		dot.style.background = '#fff';
		dot.style.animation = 'pulse 1s linear -' + timeOffset + ' infinite alternate';
		dot.style.webkitAnimation = 'pulse 1s linear -' + timeOffset + ' infinite alternate';

		spinner.appendChild(dot);
	}

	this.logo.appendChild(spinner);

	// buttons space

	this.buttons = document.createElement('div');
	this.buttons.style.background = '#f2f2f2';

	// notifications space

	this.notifications = document.createElement('div');
	s = this.notifications.style;
	s.position = 'absolute';
	s.bottom = '0';
	s.left = '0';
	s.right = '0';
	s.opacity = '0.8';

	// append everything together

	this.sidebar.appendChild(this.logo);
	this.sidebar.appendChild(this.buttons);
	this.sidebar.appendChild(this.notifications);

	parent.appendChild(this.sidebar);

	// spinner logic

	var spinnerTimer;

	mage.msgServer.on('io.send', function () {
		spinnerTimer = window.setTimeout(function () {
			spinner.style.display = '';
		}, 200);
	});

	mage.msgServer.on('io.response', function () {
		window.clearTimeout(spinnerTimer);

		spinner.style.display = 'none';
	});

	// URL hash based page-open

	mage.dashboard.ui.router.listen(/^[^\/]+/, function (match) {
		that.openPage(match[0], true);
	});
}


Sidebar.prototype.show = function () {
	this.sidebar.style.display = 'inline-block';
};


Sidebar.prototype.hide = function () {
	this.sidebar.style.display = 'none';
};


Sidebar.prototype.load = function (cb) {
	if (this.loaded) {
		if (cb) {
			cb();
		}
		return;
	}

	var that = this;

	this.loaded = true;

	function callback() {
		if (cb) {
			cb();
		}
	}

	this.delPages();

	mage.dashboard.getPages(mage.appName, function (error, pagesList) {
		if (error) {
			console.error(error);
			return callback();
		}

		var pageNames = [];
		var lastPageName;

		for (var i = 0; i < pagesList.length; i++) {
			var page = pagesList[i];

			that.addPage(page.name, page.fullName);

			pageNames.push(page.name);
			lastPageName = page.name;
		}

		if (pageNames.length === 0) {
			return callback();
		}

		mageLoader.once(lastPageName + '.loaded', callback);

		mageLoader.loadPages(pageNames);
	});
};


Sidebar.prototype.openPage = function (name, dontAlterHistory) {
	if (this.currentPage === name || !this.buttonMap.hasOwnProperty(name)) {
		return;
	}

	for (var key in this.buttonMap) {
		var button = this.buttonMap[key];
		var widget = this.pageWidgetMap[key];

		if (key === name) {
			button.style.background = '#fff';
			button.style.borderLeft = '8px solid #777';
			button.style.paddingRight = '8px';
			button.style.fontWeight = 'bold';

			this.currentPage = name;

			mageLoader.displayPage(name);

			if (!dontAlterHistory) {
				mage.dashboard.ui.router.set(name);
			}
		} else {
			button.style.background = '';
			button.style.border = 'none';
			button.style.padding = '';
			button.style.fontWeight = '';
		}

		if (widget) {
			widget.style.display = (key === name) ? '' : 'none';
		}
	}
};


Sidebar.prototype.delPages = function () {
	this.buttons.innerHTML = '';
	this.buttonMap = {};
};


Sidebar.prototype.addPage = function (name, fullName, cb) {
	var button = document.createElement('div');
	button.style.background = '#eee';
	button.style.color = '#333';
	button.style.fontSize = '13px';
	button.style.lineHeight = '50px';
	button.style.textAlign = 'center';
	button.textContent = fullName;

	this.buttonMap[name] = button;

	var that = this;

	mageLoader.once(name + '.loaded', function () {
		// Execute page javascript code

		mageLoader.renderPage(name);

		try {
			window.require(name);
		} catch (e) {
			console.error(e);
		}

		button.onclick = function () {
			that.openPage(name);
		};

		if (cb) {
			cb();
		}
	});

	this.buttons.appendChild(button);
};


/**
 * @param {string} pageName
 * @param {Array} items    Where each item is { name: 'str', cb: Function }
 */

Sidebar.prototype.setPageMenu = function (pageName, items) {
	var ul = document.createElement('ul');
	ul.style.background = '#fff';
	ul.style.margin = '0';
	ul.style.padding = '0';

	var active = null;

	items.forEach(function (item) {
		var li = document.createElement('li');
		li.style.display = 'block';
		li.style.margin = '0';
		li.style.padding = '10px 20px';
		li.style.color = '#000';
		li.style.borderLeft = '8px solid #aaa';
		li.style.listStyleType = 'none';

		li.textContent = item.name;

		li.onclick = function () {
			if (active) {
				active.style.fontWeight = '';
			}

			li.style.fontWeight = 'bold';

			active = li;

			item.cb();
		};

		ul.appendChild(li);

		item.li = li;
	});

	this.setPageWidget(pageName, ul);
};


Sidebar.prototype.clearPageWidget = function (pageName) {
	var oldWidget = this.pageWidgetMap[pageName];
	if (oldWidget) {
		this.buttons.removeChild(oldWidget);
		this.pageWidgetMap[pageName] = null;
	}
};


Sidebar.prototype.setPageWidget = function (pageName, elm) {
	var button = this.buttonMap[pageName];
	if (!button) {
		return console.warn('Cannot create a page menu for non-existing page:', pageName);
	}

	this.clearPageWidget();

	this.buttons.insertBefore(elm, button.nextSibling);

	this.pageWidgetMap[pageName] = elm;
};


Sidebar.prototype.renderNotification = function (notification) {
	var elm = notification.render();

	this.notifications.insertBefore(elm, this.notifications.firstChild);

	notification.once('close', function () {
		elm.style.opacity = '1';
		elm.style.transition = '1500ms opacity linear';
		elm.style.webkitTransition = '1500ms opacity linear';

		window.setTimeout(function () {
			elm.style.opacity = '0';
		}, 0);

		window.setTimeout(function () {
			elm.parentNode.removeChild(elm);
		}, 1600);
	});
};

module.exports = Sidebar;