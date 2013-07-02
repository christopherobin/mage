var mage = require('mage');

var forms = require('forms');
var format = require('format');
var Router = require('Router');
var Sidebar = require('Sidebar');
var NotificationCenter = require('NotificationCenter');

// this is the dashboard

var ui = mage.dashboard.ui = {
	classes: {}
};


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

// <code> and <samp> copy/paste

document.body.addEventListener('click', function (e) {
	var tag = e.target;
	if (tag) {
		while (tag.tagName === 'SPAN' && tag.parentElement) {
			tag = tag.parentElement;
		}

		if (tag.tagName === 'CODE' || tag.tagName === 'SAMP') {
			var msg;

			if (window.navigator.userAgent.indexOf('Mac OS') !== -1) {
				msg = 'Copy by pressing Cmd-C followed by RETURN';
			} else {
				msg = 'Copy by pressing Ctrl-C followed by ENTER';
			}

			window.prompt(msg, tag.textContent);
		}
	}
}, false);
