$html5client(module.giraffe);


var mod = {};
window.tool.giraffe = mod;
var extensions = [];


function setupHandlers() {
	$('#searchBtn').click(function (e) {
		var id   = $('#searchInput').val();
		var type = $('#searchType option:selected').val();
		if (id === '') {
			return;
		}

		switch (type) {
			case 'giraffe':
				mithril.giraffe.getActorIdFromGiraffeId(id, function (error, actorId) {
					if (error) {
						return console.warn('There was an error retrieving the id. ', error);
					}

					if (!actorId) {
						$('#results').empty().append('<div class="error">No id found</div>');
					} else {
						$('#results').empty().append('<div class="actorLink">Actor Id : ' + actorId + '</div>');
					}
				});

				break;

			case 'actorId':
				break;

			default:
				break;
		}


	});
}


extensions.push({
	target: 'actor',
	extend: function extendActor(extension, options, cb) {
		extension.test = 'yeah!!!!!!!!!!!!!!!!!!';
		console.log('extend');

		cb();
	},
	options: {}
});


mithril.loader.on('giraffe.extenders', function () {
	mithril.gm.extend('giraffe', extensions, function (error) {
		if (error) {
			console.warn('Module giraffe could not extend module actor');
		} else {
			console.log('Module giraffe has extended module actor');
		}
	});
});


mithril.loader.on('giraffe.loaded', function () {
	mithril.setup(function (error) {
		if (error) {
			return console.error(error);
		}

	});

	mithril.loader.displayPage('giraffe');
	setupHandlers();
});

