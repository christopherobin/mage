$html5client('module.obj');

(function (window) {
	var mithril = window.mithril;

	mithril.loader.on('obj.display', function () {
		if (!window.tool) {
			window.tool = {};
		}


		mithril.setupModules(['obj'], function (error) {
			if (error) {
				return console.error(error);
			}

			console.log('obj stuff loaded');
		});

	});
}(window));
