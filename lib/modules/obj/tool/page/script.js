$html5client(module.actor);
$html5client(module.obj);




mithril.loader.on('obj.loaded', function () {
	if (!window.tool) {
		window.tool = {};
	}


	mithril.setup(function (error) {
		if (error) {
			return console.error(error);
		}

		console.log('obj stuff loaded');
	});

	mithril.loader.displayPage('obj');
});
