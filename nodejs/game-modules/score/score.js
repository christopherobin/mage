
exports.userCommands = {
	loadRanking: __dirname + '/usercommands/loadRanking.js',
	getActorRanking: __dirname + '/usercommands/getActorRanking.js'
};


var contextMap = {};	// name: { id: 1, resolution: sec }


function parseResolution(resolution)
{
	var m;

	if ((m = resolution.match(/^([1-9][0-9]*)d$/)))
	{
		return parseInt(m[1]) * 24 * 3600;
	}

	if ((m = resolution.match(/^([1-9][0-9]*)h$/)))
	{
		return parseInt(m[1]) * 3600;
	}

	if ((m = resolution.match(/^([1-9][0-9]*)m$/)))
	{
		return parseInt(m[1]) * 60;
	}

	if ((m = resolution.match(/^([1-9][0-9]*)s?$/)))
	{
		return parseInt(m[1]);
	}

	return 1;
}


exports.setup = function(state, cb)
{
	var requiredContexts = (mithril.core.config.game && mithril.core.config.game.score && mithril.core.config.game.score.contexts) ? mithril.core.config.game.score.contexts : [];
	if (requiredContexts.length == 0)
	{
		return cb();
	}

	// find already existing contexts

	var sql = 'SELECT id, name FROM score_context';
	state.datasources.db.getMany(sql, [], null, function(error, results) {
		if (error) return cb(error);

		for (var i=0; i < results.length; i++)
		{
			var row = results[i];

			requiredContexts.forEach(function(context) { if (context.name == row.name) contextMap[context.name] = { id: row.id, resolution: parseResolution(context.resolution) }; });
		}

		var missingContexts = requiredContexts.filter(function(context) { return !(context.name in contextMap); });

		if (missingContexts.length == 0) return cb();

		// insert the non existing contexts

		async.forEachSeries(
			missingContexts,
			function(context, callback) {
				var sql = 'INSERT INTO score_context VALUES(NULL, ?)';
				var params = [context.name];

				state.datasources.db.exec(sql, params, null, function(error, info) {
					if (error) return callback(error);

					contextMap[context] = { id: info.insertId, resolution: parseResolution(context.resolution) };

					callback();
				});
			},
			function(error) {
				cb(error);
			}
		);
	});
};


exports.awardPoints = function(state, actorIds, contextName, points, cb)
{
	var context = contextMap[contextName];
	if (!context)
	{
		return state.error(null, 'Score context ' + contextName + ' not found.', cb);
	}

	if (!(actorIds instanceof Array))
	{
		return state.error(null, 'Actor IDs not an array.', cb);
	}

	var count = actorIds.length;

	if (count == 0) return cb();

	var time = mithril.core.time;

	// scale down the resolution of time if required in this context

	if (context.resolution > 1)
	{
		time = Math.floor(time / context.resolution) * context.resolution;
	}

	var values = [];
	var params = [];

	for (var i=0; i < count; i++)
	{
		values.push('(?, ?, ?, ?)');
		params.push(actorIds[i], context.id, time, points);
	}

	var sql = 'INSERT INTO score_log VALUES ' + values.join(', ') + ' ON DUPLICATE KEY UPDATE points = points + VALUES(points)';

	state.datasources.db.exec(sql, params, null, function(error) {
		if (error) return cb(error);

		values = [];
		params = [];

		for (var i=0; i < count; i++)
		{
			values.push('(?, ?, ?)');
			params.push(actorIds[i], context.id, points);
		}

		sql = 'INSERT INTO score_total VALUES ' + values.join(', ') + ' ON DUPLICATE KEY UPDATE score = score + VALUES(score)';

		state.datasources.db.exec(sql, params, null, function(error) {
			if (error) return cb(error);

			var values = actorIds.map(function() { return '?'; });

			var sql = 'SELECT actor, score FROM score_total WHERE context = ? AND actor IN (' + values.join(', ') + ')';
			var params = [context.id].concat(actorIds);

			state.datasources.db.getMany(sql, params, null, function(error, results) {
				if (error) return cb(error);

				for (var i=0; i < results.length; i++)
				{
					var row = results[i];

					state.emit(row.actor, 'score.total.edit', { to: row.score });
				}
				cb();
			});
		});
	});
};


exports.getLatestRankingListByContext = function(state, contextName, listName, cb)
{
	var context = contextMap[contextName];
	if (!context)
	{
		return state.error(null, 'Score context ' + contextName + ' not found.', cb);
	}

	// TODO: This does NOT yet check for the latest rankinglist. If there's more than 1 (or none) it breaks.

	var query = "SELECT id, name, context FROM score_rankinglist WHERE context = ? AND name = ?";
	state.datasources.db.getOne(query, [context.id, listName], true, null, cb);
};


exports.getLatestRankingListById = function(state, id, cb)
{
	// this does not load the ranks
	var query = "SELECT id, name, context FROM score_rankinglist WHERE id = ?";
	state.datasources.db.getOne(query, [id], true, null, cb);
};


exports.getRankingLists = function(state, context, name, cb)
{
	// both context and name are optional
	// this does not load the ranks
	// TODO
};


exports.getRankingData = function(state, id, range, cb)
{
	// loads the latest ranking list
	// this loads the full ranks - range is like: { from: min, to: max }
	
	var query = "SELECT srs.rank, srs.score, ad.actor, ad.value AS name FROM score_rankinglist_ranks AS srs JOIN actor_data AS ad ON srs.actor = ad.actor WHERE ad.property = ? AND srs.rankinglist = ?";
	var params = ['name', id];

	if(range)
	{
		query += ' AND srs.rank BETWEEN ? AND ? '	
		params.push(range.from);
		params.push(range.to);
	}
	state.datasources.db.getMany(query, params, null, cb);
};


exports.getRankingDataByActor = function(state, id, cb)
{
	var query = "SELECT srs.rank, srs.score, ad.actor, ad.value AS name FROM score_rankinglist_ranks AS srs JOIN actor_data AS ad ON srs.actor = ad.actor WHERE ad.property = ? AND srs.rankinglist = ? AND ad.actor = ?";
	var params = ['name', id, state.actorId];
	
	state.datasources.db.getOne(query, params, true, null, cb);
};


exports.getFullRankingLists = function(state, context, name, onlyLatest, cb)
{
	// both context and name are optional
	// this loads the full ranks

	// TODO
};


exports.getFullRankingList = function(state, id, cb)
{
	// this loads a complete ranking list with its ranks

	// TODO
};


exports.generateRankingList = function(state, contextName, name, ascending, interval, cb)
{
	// makes a ranking of all scores between interval.from (inclusive) and interval.until (exclusive)
	// interval and ascending are optional

	var context = contextMap[contextName];
	if (!context)
	{
		return state.error(null, 'Score context ' + contextName + ' not found.', cb);
	}

	var sql = 'INSERT INTO score_rankinglist VALUES(NULL, ?, ?, ?)';
	var params = [context.id, name, mithril.core.time];

	state.datasources.db.exec(sql, params, null, function(error, info) {
		if (error) return cb(error);

		var rankingListId = info.insertId;

		// create the list

		state.datasources.db.exec('SET @N = 0', [], null, function(error, info) {
			if (error) return cb(error);

			var sql = 'INSERT INTO score_rankinglist_ranks SELECT ?, @N := @N +1, actor, SUM(points) AS total FROM score_log WHERE context = ?';
			var params = [rankingListId, context.id];

			if (interval)
			{
				sql += ' AND receivedTime BETWEEN ? AND ?';
				params.push(interval.from, interval.until - 1);
			}

			sql += ' GROUP BY actor ORDER BY total ' + (ascending ? 'ASC' : 'DESC');

			state.datasources.db.exec(sql, params, null, function(error, info) {
				if (error) return cb(error);

				cb(null, rankingListId);
			});
		});
	});
};


exports.delRankingList = function(state, id, cb)
{
	// TODO
};


exports.delOldRankingLists = function(state, olderThanTime, cb)
{
	// TODO
};

