var mage = require('mage');
var mageLoader = require('loader');

var page = mageLoader.renderPage('postlogin');
page.innerHTML = require('./page.html');

var forms = require('forms');
var format = require('format');
var Router = require('Router');
var Sidebar = require('Sidebar');
var FileCrawler = require('FileCrawler');
var NotificationCenter = require('NotificationCenter');
var clipboard = require('clipboard');

// this is the dashboard

var ui = mage.dashboard.ui = {
	classes: {
		FileCrawler: FileCrawler
	}
};

ui.clipboard = clipboard;
ui.router = new Router();
ui.sidebar = new Sidebar(document.body);
ui.notifications = new NotificationCenter();
ui.forms = forms;
ui.format = format;

ui.notifications.addRenderTarget(ui.sidebar, { ttl: 5000, maxLength: 5 });

ui.sidebar.show();
ui.sidebar.load(function () {
	if (ui.router.getCurrent()) {
		ui.router.broadcast();
	} else {
		ui.sidebar.openPage('home');
	}
});

// resend logic

mage.httpServer.on('io.error.network', function () {
	console.warn('httpServer timed out');

	window.setTimeout(function () {
		console.log('httpServer resending');
		mage.httpServer.resend();
	}, 2000);
});


mage.httpServer.on('io.error.auth', function (path, data) {
	var msg = data ? data.info : null;

	ui.notifications.send('Authentication error', msg);

	var q = 'Authentication error';
	if (msg) {
		q += ' (' + msg + ')';
	}

	q += '. Reload the dashboard?';

	if (window.confirm(q)) {
		window.location.reload();
	}
});
