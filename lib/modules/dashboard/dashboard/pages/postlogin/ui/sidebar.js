(function () {

	var mage = window.mage;


	function Sidebar(parent) {
		this.loaded = false;
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


	Sidebar.prototype.load = function () {
		if (this.loaded) {
			return;
		}

		this.delPages();

		var that = this;

		mage.dashboard.getPages(mage.appName, function (error, pagesList) {
			if (error) {
				console.error(error);
				return;
			}

			for (var i = 0; i < pagesList.length; i++) {
				var page = pagesList[i];

				that.addPage(page.name, page.fullName);
			}
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
	};


	Sidebar.prototype.addPage = function (name, fullName) {
		var button = document.createElement('div');
		button.style.fontSize = '13px';
		button.style.lineHeight = '50px';
		button.style.textAlign = 'center';
		button.style.color = '#333';
		button.textContent = fullName;

		this.buttonMap[name] = button;

		var that = this;

		mage.loader.once(name + '.loaded', function () {
			button.onclick = function () {
				that.openPage(name);
			};
		});

		mage.loader.loadPage(name);

		this.buttons.appendChild(button);
	};


	mage.dashboard.ui.sidebar = new Sidebar(document.body);

}());