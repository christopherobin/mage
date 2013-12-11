var mage = require('mage');
var mageLoader = require('loader');

mage.msgServer.setCmdMode('free'); // user commands do not block each other on the dashboard


var loggingIn = false;


function login(params, cb) {
	if (loggingIn) {
		return false;
	}

	loggingIn = true;

	mage.ident.check('default', params, function (error) {
		if (error) {
			loggingIn = false;
			return cb(error);
		}

		mageLoader.once('postlogin.loaded', function () {
			mageLoader.displayPage('postlogin');

			window.require('postlogin');

			cb();
		});

		mageLoader.loadPage('postlogin');
	});
}


function start() {
	// make sure all HTML is in place

	var page = mageLoader.renderPage('login');
	var space = page.querySelector('.loginSpace');
	var errorElm;

	function loginCallback(error) {
		if (error) {
			if (!errorElm) {
				errorElm = space.appendChild(document.createElement('div'));
				errorElm.className = 'error';
			}

			errorElm.style.display = '';
			errorElm.textContent = 'Invalid credentials';
			return;
		}

		// remove the login space, we'll never need it again
		space.parentNode.removeChild(space);
	}


	// check for the default authentication engine
	var authType = mage.ident.engines.default;

	if (authType === 'anonymous') {
		return login(loginCallback);
	}

	var focusElm;

	if (authType === 'userpass' || authType === 'ldap') {
		var form = space.appendChild(document.createElement('form'));
		form.innerHTML = '<h1>Login</h1>';

		errorElm = form.appendChild(document.createElement('h4'));
		errorElm.className = 'error';

		var div, username, password;

		div = form.appendChild(document.createElement('div'));
		div.textContent = 'Login:';
		username = div.appendChild(document.createElement('input'));
		username.type = 'text';

		div = form.appendChild(document.createElement('div'));
		div.textContent = 'Password:';
		password = div.appendChild(document.createElement('input'));
		password.type = 'password';

		div = form.appendChild(document.createElement('div'));
		var btn = div.appendChild(document.createElement('button'));
		btn.textContent = 'Login';

		focusElm = username;

		form.onsubmit = function (ev) {
			ev.preventDefault();

			errorElm.style.display = 'none';

			login({ username: username.value, password: password.value }, loginCallback);

			return false;
		};
	} else {
		space.textContent = 'No engines are configured for the ident module.';
	}

	// use the logo's load time as a trigger for fade-in

	var logo = page.querySelector('.logo');

	var img = new Image();

	img.src = mage.assets.img('mage_logo_white_font');

	img.onload = function () {
		logo.style.opacity = '1';
		space.style.opacity = '1';

		if (focusElm) {
			focusElm.focus();
		}

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
