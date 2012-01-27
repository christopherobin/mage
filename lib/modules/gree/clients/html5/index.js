(function (window) {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.gree.construct'));


	mod.setup = function (cb) {
		mithril.io.on('gree.redirect', function (path, params) {
			if (params.url) {
				window.location.href = params.url;
			}
		});

		cb();
	};


	var people = mod.people = {};

	var userIdMap = {};	// cache for friends' actorId -> Gree userId
	var greepf = window.greepf;
	var opensocial = window.opensocial;


	mod.actorIdToUserId = function (actorId) {
		return userIdMap[actorId] || false;
	};


	mod.userIdToActorId = function (userId) {
		for (var actorId in userIdMap) {
			if (userIdMap[actorId] === userId) {
				return ~~actorId;
			}
		}
		return false;
	};


	function getUserIds(actorIds, cb) {
		var unknown = [];
		var known = {};

		for (var i = 0, len = actorIds.length; i < len; i++) {
			var actorId = actorIds[i];
			var userId = userIdMap[actorId];

			if (userId) {
				known[actorId] = userId;
			} else {
				unknown.push(actorId);
			}
		}

		if (unknown.length > 0) {
			mod.getUserIds(unknown, function (error, users) {
				if (error) {
					return cb(error);
				}

				// update the userIdMap and known list

				for (var actorId in users) {
					var userId = users[actorId];

					userIdMap[actorId] = userId;
					known[actorId] = userId;
				}

				cb(null, known);
			});
		} else {
			cb(null, known);
		}
	}


	people.getThumbnails = function (actorIds, size, cb) {
		if (!greepf || !greepf.requestThumbnail) {
			return cb(null, []);
		}

		// get all user IDs for the requested actors

		getUserIds(actorIds, function (error, users) {
			if (error) {
				return cb(null, {});
			}

			var request = [];
			var reverseMap = {};

			for (var actorId in users) {
				var userId = users[actorId];

				request.push({ userId: userId, size: size });

				reverseMap[userId] = actorId;
			}

			greepf.requestThumbnail(request, function (response) {
				var thumbnails = {};	// { actorId: url }
				var data = response.getData();

				if (data && data.urls) {
					for (var i = 0, len = data.urls.length; i < len; i++) {
						var info = data.urls[i];
						var actorId = reverseMap[info.user_id];

						if (actorId) {
							thumbnails[actorId] = info.url;
						}
					}
				}

				cb(null, thumbnails);
			});
		});
	};


	people.getFriends = function (fields, cb) {
		mod.getFriends({ fields: fields }, cb);
	};


	people.inviteFriends = function (title, cb) {
		if (!opensocial || !opensocial.requestShareApp) {
			return cb('noOpenSocial');
		}

		opensocial.requestShareApp('VIEWER_FRIENDS', title, function (response) {
			var data = response.getData();

			if (data && data.recipientIds && data.recipientIds.length > 0) {
				cb(null, data.recipientIds);
			} else {
				cb(null, []);
			}
		});
	};

}(window));
