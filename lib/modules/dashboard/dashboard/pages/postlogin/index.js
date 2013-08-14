var mage = require('mage');

var forms = require('forms');
var format = require('format');
var Router = require('Router');
var Sidebar = require('Sidebar');
var FileCrawler = require('FileCrawler');
var NotificationCenter = require('NotificationCenter');
var Clipboard = require('Clipboard');

// this is the dashboard

var ui = mage.dashboard.ui = {
	classes: {
		FileCrawler: FileCrawler
	}
};

ui.Clipboard = Clipboard;
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

mage.msgServer.on('io.error.network', function () {
	console.warn('msgServer timed out');

	window.setTimeout(function () {
		console.log('msgServer resending');
		mage.msgServer.resend();
	}, 2000);
});
