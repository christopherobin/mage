var mage = require('mage');
var msgServer = require('msgServer');

var Sidebar = require('Sidebar');
var NotificationCenter = require('NotificationCenter');

// this is the dashboard

mage.dashboard.ui = {
	classes: {}
};

var sidebar = new Sidebar(document.body);
var notifications = new NotificationCenter();

mage.dashboard.ui.sidebar = sidebar;
mage.dashboard.ui.notifications = notifications;

notifications.addRenderTarget(sidebar, { ttl: 5000, maxLength: 5 });

sidebar.show();
sidebar.load(function () {
	sidebar.openPage('home');
});

// resend logic

msgServer.on('io.error.network', function () {
	console.warn('msgServer timed out');

	window.setTimeout(function () {
		console.log('msgServer resending');
		msgServer.resend();
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
