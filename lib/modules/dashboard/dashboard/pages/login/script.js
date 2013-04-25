$html5client('io');
$html5client('modulesystem');
$html5client('module.assets');
$html5client('module.session');
$html5client('module.dashboard');

(function () {
	var mage = window.mage;
	var sidebar;


	function Sidebar(parent) {
		this.loaded = false;
		this.currentPage = null;
		this.buttonMap = {};

		var s;

		// sidebar container

		this.sidebar = document.createElement('nav');
		s = this.sidebar.style;

		s.display = 'none';
		s.position = 'fixed';
		s.top = '0';
		s.bottom = '0';
		s.width = '200px';
		s.background = 'rgb(242,242,242)';

		// logo

		this.logo = document.createElement('div');
		s = this.logo.style;

		s.backgroundImage = 'url(\'' + mage.assets.img('mage_logo_white_font') + '\')';
		s.backgroundSize = 'contain';
		s.backgroundColor = '#393939';
		s.backgroundRepeat = 'no-repeat';
		s.backgroundPosition = 'center';
		s.height = '120px';

		// buttons space

		this.buttons = document.createElement('div');

		// append everything together

		this.sidebar.appendChild(this.logo);
		this.sidebar.appendChild(this.buttons);
		parent.appendChild(this.sidebar);
	}


	Sidebar.prototype.show = function () {
		this.sidebar.style.display = 'inline-block';
	};


	Sidebar.prototype.hide = function () {
		this.sidebar.style.display = 'none';
	};


	Sidebar.prototype.load = function (cb) {
		if (!mage.dashboard) {
			console.error('No GM');
			return cb('No GM');
		}

		if (this.loaded) {
			return cb();
		}

		this.delPages();

		this.buttons.innerText = 'Loading...';

		var that = this;

		mage.dashboard.getPages(mage.appName, function (error, pagesList) {
			if (error) {
				console.error(error);
				return cb(error);
			}

			mage.loader.once('home.loaded', function () {
				that.openPage('home');
			});

			that.delPages();

			var names = [];

			for (var i = 0; i < pagesList.length; i++) {
				var page = pagesList[i];

				names.push(page.name);

				that.addPage(page.name, page.fullName);
			}

			mage.loader.loadPages(names);

			cb();
		});
	};


	Sidebar.prototype.openPage = function (name) {
		for (var key in this.buttonMap) {
			var button = this.buttonMap[key];

			if (key === name) {
				mage.loader.displayPage(name);

				button.style.background = '#fff';
				button.style.borderLeft = '8px solid rgb(111,111,111)';
				button.style.paddingRight = '8px';
				button.style.fontWeight = 'bold';

				this.currentPage = name;
			} else {
				button.style.background = '';
				button.style.border = 'none';
				button.style.padding = '';
				button.style.fontWeight = '';
			}
		}
	};


	Sidebar.prototype.delPages = function () {
		this.buttons.innerHTML = '';
		this.buttonMap = {};
		this.currentPage = null;
	};


	Sidebar.prototype.addPage = function (name, fullName) {
		var button = document.createElement('div');
		button.style.fontSize = '13px';
		button.style.lineHeight = '50px';
		button.style.textAlign = 'center';
		button.style.color = '#333';
		button.innerText = fullName;

		this.buttonMap[name] = button;

		var that = this;

		button.onclick = function () {
			that.openPage(name);
		};

		if (name === this.currentPage) {
			// force correct rendering of this button

			this.openPage(name);
		}

		this.buttons.appendChild(button);
	};


	mage.configure({});


	function authenticated() {
		sidebar.show();
		sidebar.load(function () {
			console.log('loaded...');
		});
	}


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
				authenticated();
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

		sidebar = new Sidebar(document.body);
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
