$html5client('module.giraffe');

(function (window) {

	var mod = {};
	window.tool.giraffe = mod;
	var extensions = [];
	var mithril = window.mithril;
	var setup = false;


	function setupHandlers() {
		$('#giraffeBroadcastSend').click(function (e) {
			if ($('#giraffeBroadcastMessage').val() === '') {
				return;
			}

			var res = confirm('Are you sure you want to send to everybody?');

			if (!res) {
				return;
			}
			mithril.giraffe.broadcast(null, $('#giraffeBroadcastMessage').val(), function (err) {
				if (err) {
					alert(err);
				}
				$('#giraffeBroadcastMessage').val('');
			});
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
		type: 'selector',
		target: 'actor',
		name: 'giraffe',
		extendFn: getActorId
	});



	mithril.gm.extend(extensions, function (error) {
		if (error) {
			console.warn('Module giraffe could not extend.');
		}
	});


	mithril.loader.on('giraffe.display', function () {
		if (!setup) {
			setup = true;

			mithril.setupModules(['giraffe'], function (error) {
				if (error) {
					return console.error(error);
				}

				setupHandlers();
			});
		}
	});
}(window));
