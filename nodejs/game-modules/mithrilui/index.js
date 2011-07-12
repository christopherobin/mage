exports.resources = require(__dirname + '/resources.js');


exports.setup = function(state, cb)
{
	mithril.addRoute('/ui/game.manifest', function(request, path, params, callback) {

		mithril.player.sessions.find(state, params.playerId, function(error, session) {
			if (error) return callback(false);

			var state = new mithril.core.state.State(params.playerId, null, session);

			exports.resources.getManifest(state, function(error, manifest) {
				state.close();

				console.log('Returning manifest: ' + manifest);

				if (error) return callback(false);

				callback(200, manifest, { 'Content-type': 'text/manifest' });
			});
		});
	});


	mithril.addRoute(/^\/ui\/.+?\/package\.txt$/, function(request, path, params, callback) {
		var page = path.split('/', 3)[2];

		exports.resources.pages.getPackage(page, function(error, data) {
			if (error)
			{
				return callback(false);
			}

			callback(200, data, { 'Content-type': 'text/plain' });
		});
	});

	cb();
};


