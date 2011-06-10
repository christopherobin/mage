function MithrilGameModGree(mithril)
{
	this.mithril = mithril;
	this.userIdMap = {};	// cache for actorId -> userId lookup
}


MithrilGameModGree.prototype.setup = function(cb)
{
	this.people = new MithrilGameModGree_People(this);

	cb();
};


MithrilGameModGree.prototype.actorIdToUserId = function(actorId)
{
	return this.userIdMap[actorId] || false;
};


MithrilGameModGree.prototype.userIdToActorId = function(userId)
{
	for (var actorId in this.userIdMap)
	{
		if (this.userIdMap[actorId] == userId) return ~~actorId;
	}
	return false;
};


function MithrilGameModGree_People(gree)
{
	this.gree = gree;
};


MithrilGameModGree_People.prototype.getThumbnails = function(actorIds, size, returnChunks, cb)
{
	//	var isMe = (!actorId || actorId == this.gree.mithril.actor.me.id);

	// fields: "thumbnailUrl", "thumbnailUrlSmall", "thumbnailUrlLarge"

	var knownUsers = [];
	var unknownActorIds = [];

	if (typeof greepf !== 'undefined' && greepf.requestThumbnail)
	{
		var len = actorIds.length;
		for (var i=0; i < len; i++)
		{
			var actorId = actorIds[i];
			var userId = this.gree.actorIdToUserId(actorId);

			if (userId)
				knownUsers.push({ userId: userId });
			else
				unknownActorIds.push(actorId);
		}
	}
	else
		unknownActorIds = actorIds;

	var tasks = [];

	if (knownUsers.length > 0)
	{
		tasks.push(function(callback) {
			greepf.requestThumbnail(knownUsers, function(response) {
				var thumbnails = [];	// { actorId: url }
				var data = response.getData();

				if (data.urls)
				{
					var len = data.urls.length;
					for (var i=0; i < len; i++)
					{
						thumbnails.push(data.urls[i]);
					}
				}

				callback(thumbnails);
			});
		});
	}

	if (unknownActorIds.length > 0)
	{
		var _this = this;
		var field = 'thumbnailUrl' + (size ? size[0].toUpperCase() + size.substring(1) : '');

		tasks.push(function(callback) {
			_this.gree.mithril.io.send('gree.getPeople', { actorIds: unknownActorIds, fields: [field] }, function(error, people) {
				var thumbnails = [];	// { actorId: url }

				var len = people.length;
				for (var i=0; i < len; i++)
				{
					var thumb = {};
					thumb[people[i].actorId] = people[i][field];

					thumbnails.push(thumb);
				}

				callback(thumbnails);
			});
		});
	}

	// run tasks in parallel

	var thumbnails = [];
	var remaining = tasks.length;
	for (var i=0; i < tasks.length; i++)
	{
		tasks[i](function(thumbs) {
			if (returnChunks)
			{
				return cb(null, thumbs);
			}

			thumbnails = thumbnails.concat(thumbs);

 			if (--remaining == 0)
			{
				cb(null, thumbnails);
			}
		});
	}
};


MithrilGameModGree_People.prototype.getFriends = function(fields, cb)
{
	this.gree.mithril.io.send('gree.getFriends', { fields: fields, addActorIds: true }, cb);
};

