(function () {

	// this is the dashboard

	var mage = window.mage;

	mage.dashboard.ui = {
		classes: {}
	};

	mage.loader.once('postlogin.loaded', function () {
		var sidebar = new mage.dashboard.ui.classes.Sidebar(document.body);
		var notifications = new mage.dashboard.ui.classes.NotificationCenter();

		mage.dashboard.ui.sidebar = sidebar;
		mage.dashboard.ui.notifications = notifications;

		notifications.addRenderTarget(sidebar, { ttl: 5000, maxLength: 5 });

		mage.loader.once('home.loaded', function () {
			sidebar.openPage('home');
		});

		sidebar.show();
		sidebar.load();
	});

}());