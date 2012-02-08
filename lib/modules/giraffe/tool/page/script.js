$html5client(module.giraffe);


if (!window.tool) {
	window.tool = {};
}

var giraffe = {};
window.tool.giraffe = giraffe;



mithril.loader.on('actor.loaded', function () {
	mithril.setup(function (error) {
		if (error) {
			return console.error(error);
		}


	});

	mithril.loader.displayPage('giraffe');
});
