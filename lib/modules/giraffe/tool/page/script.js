$html5client('module.giraffe');

(function (window) {

	var mod = {};
	window.tool.giraffe = mod;
	var extensions = [];
	var mithril = window.mithril;


	function setupHandlers() {
		$('#giraffe_searchBtn').click(function (e) {
			var id   = $('#searchInput').val();
			var type = $('#searchType option:selected').val();
			if (id === '') {
				return;
			}

			switch (type) {
				case 'giraffe':
					getActorId(id, function (error, ids) {
						if (error) {
							return console.warn('There was an error retrieving the id. ', error);
						}

						if (ids.length === 0) {
							$('#results').empty().append('<div class="error">No id found</div>');
						} else {
							$('#results').empty().append('<div class="actorLink">Actor Id : ' + actorId[0] + '</div>');
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


	function getActorId(query, cb) {
		mithril.giraffe.getActorIdFromGiraffeId(query, function (error, actorId) {
			if (error) {
				return cb(error);
			}

			var ids = [];

			if (actorId) {
				ids.push(actorId);
			}

			cb(null, ids);
		});
	}

	extensions.push({
		selector: 'actor',
		name: 'giraffe',
		extendFn: getActorId
	});


	mithril.loader.on('giraffe.loaded', function () {
		mithril.gm.extend('giraffe', extensions, function (error) {
			if (error) {
				console.warn('Module giraffe could not extend module actor');
			} else {
				console.log('Module giraffe has extended module actor');
			}
		});
	});


	mithril.loader.on('giraffe.display', function () {
		mithril.setupModules(['giraffe'], function (error) {
			if (error) {
				return console.error(error);
			}
			setupHandlers();
		});
	});
}(window));
