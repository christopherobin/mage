function Tool(screenSize) {
	var _this = this;
	this.screenSize = screenSize;
	

	this.init = function (cb) {
		this.views	      = new Viewport(app);
		this.viewport     = document.getElementById("viewport");
		this.ui		      = new UiManager(_this);

		// Load gm modules
		this.mithril      = window.mithril;

		cb();
	}
}
