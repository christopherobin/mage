function Tool(options) {
	var _this       = this;
	this.screenSize = options.screen;
	this.language   = options.language || 'EN';
	

	this.init = function (cb) {
		this.views	      = window.viewport;
		this.viewport     = document.getElementById("viewport");
//		this.ui		      = new UiManager(_this);

		// Load gm modules
		this.mithril      = window.mithril;

		cb();
	}
}
