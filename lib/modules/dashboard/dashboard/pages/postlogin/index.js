var mage = require('mage');

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
sidebar.load();

sidebar.addPage('home', 'Home', function () {
	sidebar.openPage('home');
});
