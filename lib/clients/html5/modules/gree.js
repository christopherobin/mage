(function () {

	var mithril = window.mithril;

	var mod = {};

	mithril.registerModule('gree', mod);


	var people = mod.people = {};

	var userIdMap = {};	// cache for friends' actorId / Gree userId
	var greepf = window.greepf;


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


	people.getThumbnails = function (actorIds, size, returnChunks, cb) {
		var knownUsers = [];
		var unknownActorIds = [];

		if (!greepf || !greepf.requestThumbnail) {
			return cb(null, []);
		}

		var i, len = actorIds.length;
		for (i = 0; i < len; i++) {
			var actorId = actorIds[i];
			var userId = userIdMap[actorId];

			if (userId) {
				knownUsers.push({ userId: userId });
			} else {
				unknownActorIds.push(actorId);
			}
		}

		var tasks = [];

		if (knownUsers.length > 0) {
			tasks.push(function (callback) {
				greepf.requestThumbnail(knownUsers, function (response) {
					// TODO: untested, and probably doesn't work

					var thumbnails = [];	// { actorId: url }
					var data = response.getData();

					if (data.urls) {
						var len = data.urls.length;
						for (var i = 0; i < len; i++) {
							thumbnails.push(data.urls[i]);
						}
					}

					callback(thumbnails);
				});
			});
		}

		if (unknownActorIds.length > 0) {
			var field = null;

			switch (size) {
			case 'normal':
				field = 'thumbnailUrl';
				break;
			case 'small':
				field = 'thumbnailUrlSmall';
				break;
			case 'large':
				field = 'thumbnailUrlLarge';
				break;
			case 'huge':
				field = 'thumbnailUrlHuge';
				break;
			}

			tasks.push(function (callback) {
				mithril.io.send('gree.getUserIds', { actorIds: unknownActorIds }, null, function (error, people) {
					var users = [];

					for (var actorId in people) {
						var userId = people[actorId];
						users.push({ userId: userId });
					}

					greepf.requestThumbnail(users, function (response) {
						var thumbnails = [];	// { actorId: url }
						var data = response.getData();

						if (data.urls) {
							var len = data.urls.length;
							for (var i = 0; i < len; i++) {
								thumbnails.push(data.urls[i]);
							}
						}

						callback(thumbnails);
					});
				});
			});
		}

		// run tasks in parallel

		len = tasks.length;
		var thumbnails = [];
		var remaining = len;

		var callback = function (thumbs) {
			if (returnChunks) {
				return cb(null, thumbs);
			}

			thumbnails = thumbnails.concat(thumbs);

			if (--remaining === 0) {
				cb(null, thumbnails);
			}
		};

		for (i = 0; i < len; i++) {
			tasks[i](callback);
		}
	};


	people.getFriends = function (fields, cb) {
		mithril.io.send('gree.getFriends', { fields: fields }, null, cb);
	};

}());
