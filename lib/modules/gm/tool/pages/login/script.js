$html5client('io');
$html5client('modulesystem');
$html5client('module.assets');
$html5client('module.session');
$html5client('module.gm');

(function () {
	var mage = window.mage;

	mage.configure({});


	function authenticated() {
		mage.gm.getPages(function (error, pagesList) {
			if (error) {
				console.error(error);
			}

			mage.loader.loadPages(['main'], pagesList);
		});
	}


	var loggingIn = false;

	function authenticate() {
		if (loggingIn) {
			return false;
		}

		loggingIn = true;

		mage.gm.startAnonymousSession(function (error) {
			window.setTimeout(function () {
				loggingIn = false;
			}, 1000);

			if (!error) {
				authenticated();
			}
		});
	}


	function start() {
		mage.loader.displayPage('login');

		// enable anonymous login

		var anon = document.getElementById('anonymousLogin');
		anon.onclick = authenticate;
	}


	mage.loader.once('login.loaded', function () {
		mage.setupModules(['assets', 'gm'], function () {
			start();
		});
	});

}());
