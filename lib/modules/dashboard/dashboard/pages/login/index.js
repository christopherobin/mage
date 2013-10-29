var mage = require('mage');
var mageLoader = require('loader');

var loggingIn = false;


function login(params) {
	if (loggingIn) {
		return false;
	}

	document.getElementById('loginError').style.display = 'none';

	loggingIn = true;

	mage.ident.check('default', params, function (err) {
		if (err) {
			loggingIn = false;
			document.getElementById('loginError').style.display = 'block';
			return;
		}

		mageLoader.once('postlogin.loaded', function () {
			mageLoader.displayPage('postlogin');

			window.require('postlogin');
		});

		mageLoader.loadPage('postlogin');
	});
}


function start() {
	// make sure all HTML is in place

	mageLoader.renderPage('login');

	// check for the default authentication engine
	var authType = mage.ident.engines.default;

	// anonymous login
	var btn = document.getElementById('anonymousLogin');

	// form login
	var loginForm = document.getElementById('loginForm');

	if (authType) {
		// anonymous auth
		if ((authType === "anonymous") && mage.isDevelopmentMode()) {
			// show it
			login();
			/*btn.style.display = 'inline-block';
			btn.onclick = function () {
				login();
			};*/
		}

		if (authType === "userpass" || authType === "ldap") {
			// show it
			loginForm.style.display = 'block';
			loginForm.onsubmit = function (ev) {
				ev.preventDefault();

				login({
					username: document.getElementById('username').value,
					password: document.getElementById('password').value
				});

				return false;
			};
		}
	}

	// use the logo's load time as a trigger for fade-in

	var logo = document.getElementById('login-logo');

	var img = new Image();

	img.src = mage.assets.img('mage_logo_white_font');

	img.onload = function () {
		logo.style.opacity = '1';
		btn.style.opacity = '1';
		loginForm.style.opacity = '1';

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
	'ident',
	'dashboard'
);


mage.setupModules(['logger', 'assets', 'session', 'ident', 'dashboard'], function () {
	// make sure all assets are applied to the stylesheet of the loader

	mage.assets.applyAssetMapToContent(document.styleSheets);

	// display the page

	start();
});
