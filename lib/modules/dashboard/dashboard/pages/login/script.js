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


	function setupScreen() {
		var page = mage.loader.getPage('login');

		// logo

		var imgSrc = mage.assets.img('mage_logo_white_font');

		var logo = document.createElement('div');
		var s = logo.style;
		s.margin = '100px auto 20px auto';
		s.textAlign = 'center';
		s.background = 'url(' + imgSrc + ')';
		s.width = '200px';
		s.height = '200px';
		s.backgroundSize = '100% 100%';
		s.transition = 'opacity 1s';
		s.setProperty('-webkit-transition', 'opacity 1s');
		s.opacity = '0';

		// logo fade in on load

		var img = new Image();
		img.src = imgSrc;

		img.onload = function () {
			s.opacity = '1';
		};

		// anonymous login

		var btn = document.createElement('input');
		btn.type = 'button';
		btn.id = 'anonymousLogin';
		btn.value = 'Anonymous login';

		btn.onclick = authenticate;

		page.appendChild(logo);
		page.appendChild(btn);
	}


	function start() {
		mage.loader.renderPage('login');

		setupScreen();

		mage.loader.displayPage('login');
	}


	mage.loader.once('login.loaded', function () {
		mage.setupModules(['assets', 'session', 'dashboard'], function () {
			start();
		});
	});

}());
