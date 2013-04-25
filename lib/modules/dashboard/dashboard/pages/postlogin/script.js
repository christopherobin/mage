(function () {

	// this is the dashboard

	var mage = window.mage;

	mage.dashboard.ui = {};

	mage.loader.once('postlogin.loaded', function () {
		var sidebar = mage.dashboard.ui.sidebar;

		mage.loader.once('home.loaded', function () {
			sidebar.openPage('home');
		});

		sidebar.show();
		sidebar.load();
	});

}());