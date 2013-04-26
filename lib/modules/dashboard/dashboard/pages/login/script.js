$html5client('io');
$html5client('modulesystem');
$html5client('module.assets');
$html5client('module.session');
$html5client('module.dashboard');

(function () {
	var mage = window.mage;

	mage.configure({});


	var loggingIn = false;

	function authenticate() {
		if (loggingIn) {
			return false;
		}

		loggingIn = true;

		mage.dashboard.startAnonymousSession(function (error) {
			window.setTimeout(function () {
				loggingIn = false;
			}, 1000);

			if (!error) {
				mage.loader.loadPage('postlogin');
			}
		});
	}


	function start() {
		// make sure all HTML is in place

		mage.loader.renderPage('login');

		// anonymous login

		var btn = document.getElementById('anonymousLogin');

		btn.onclick = authenticate;

		// use the logo's load time as a trigger for fade-in

		var logo = document.getElementById('login-logo');

		var img = new Image();

		img.src = mage.assets.img('mage_logo_white_font');

		img.onload = function () {
			logo.style.opacity = '1';
			btn.style.opacity = '1';
			img.onload = null;
		};

		// display the login screen

		mage.loader.displayPage('login');
	}


	mage.loader.once('login.loaded', function () {
		mage.setupModules(['assets', 'session', 'dashboard'], function () {
			// make sure all assets are applied to the stylesheet of the loader

			mage.assets.applyAssetMapToContent(document.styleSheets);

			// display the page

			start();
		});
	});

}());
