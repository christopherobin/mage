var mage = require('mage');
var mageLoader = require('loader');

mage.msgServer.setCmdMode('free'); // user commands do not block each other on the dashboard

var page, space;
var loggingIn = false;


function getBestEngine(preference, engines) {
	var bestIndex = Infinity;
	var best;

	for (var i = 0; i < engines.length; i++) {
		var engine = engines[i];

		if (engine.access === 'admin') {
			var index = preference.indexOf(engine.type);

			if (index !== -1 && index < bestIndex) {
				best = engine;
				bestIndex = index;
			}
		}
	}

	return best;
}


function displayError(cnt) {
	if (!cnt) {
		cnt = space.appendChild(document.createElement('div'));
		cnt.className = 'error';
	}

	cnt.style.display = '';
	cnt.textContent = 'Invalid credentials';
}


function login(engineName, credentials, errorElm) {
	if (loggingIn) {
		return false;
	}

	loggingIn = true;

	mage.ident.login(engineName, credentials, null, function (error) {
		if (error) {
			loggingIn = false;
			displayError(errorElm);
			return;
		}

		mageLoader.loadPackage('postlogin', function () {
			mageLoader.displayPackage('postlogin');

			window.require('postlogin');

			// remove the login space, we'll never need it again
			space.parentNode.removeChild(space);
		});
	});
}


function displayUserPassUi(engine, space) {
	var form = space.appendChild(document.createElement('form'));
	form.innerHTML = '<h1>Login</h1>';

	var errorElm = form.appendChild(document.createElement('h4'));
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

	form.onsubmit = function (ev) {
		ev.preventDefault();

		errorElm.style.display = 'none';

		login(engine.engineName, { username: username.value, password: password.value }, errorElm);

		return false;
	};

	username.focus();
}


function start(engines) {
	var engine = getBestEngine(['anonymous', 'ldap', 'userpass'], engines);

	switch (engine && engine.type) {
	case 'anonymous':
		return login(engine.engineName);
	case 'userpass':
	case 'ldap':
		displayUserPassUi(engine, space);
		break;
	default:
		space.textContent = 'No ident engines with "admin" level access have been configured.';
	}

	// use the logo's load time as a trigger for fade-in

	var logo = page.querySelector('.logo');

	var img = new Image();

	img.src = mage.assets.img('mage_logo_white_font');

	img.onload = function () {
		logo.style.opacity = '1';
		space.style.opacity = '1';
		img.onload = null;
	};

	// display the login screen

	mageLoader.displayPackage('login');
}


mage.useModules(require,
	/* mage modules */
	'logger',
	'assets',
	'session',
	'ident',
	'dashboard'
);


mage.setupModules(['logger', 'assets', 'session', 'ident', 'dashboard']);

mage.ident.getEngines(function (error, engines) {
	if (error) {
		return console.error(error);
	}

	// make sure all assets are applied to the stylesheet of the loader

	mage.assets.applyAssetMapToContent(document.styleSheets);

	// display the page

	page = mageLoader.injectHtml('login');
	space = page.querySelector('.loginSpace');

	start(engines);
});
