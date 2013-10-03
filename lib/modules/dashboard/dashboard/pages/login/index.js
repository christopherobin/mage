var mage = require('mage');
var mageLoader = require('loader');

var loggingIn = false;


function loginAnonymous() {
	if (loggingIn) {
		return false;
	}

	loggingIn = true;

	mage.session.loginAnonymous('admin', function (error) {
		window.setTimeout(function () {
			loggingIn = false;
		}, 1000);

		if (!error) {
			mageLoader.once('postlogin.loaded', function () {
				mageLoader.displayPage('postlogin');

				window.require('postlogin');
			});

			mageLoader.loadPage('postlogin');
		}
	});
}


function start() {
	// make sure all HTML is in place

	mageLoader.renderPage('login');

	// anonymous login

	var btn = document.getElementById('anonymousLogin');

	if (mage.isDevelopmentMode()) {
		btn.onclick = loginAnonymous;
	} else {
		btn.style.display = 'none';
	}

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

	mageLoader.displayPage('login');
}


mage.useModules(require,
	/* mage modules */
	'logger',
	'assets',
	'session',
	'dashboard'
);


mage.setupModules(['logger', 'assets', 'session', 'dashboard'], function () {
	// make sure all assets are applied to the stylesheet of the loader

	mage.assets.applyAssetMapToContent(document.styleSheets);

	// display the page

	start();
});
