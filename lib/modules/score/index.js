var mithril = require('../../mithril'),
    async = require('async');


var contextMap = {};	// name: { id: 1, resolution: sec }


function parseResolution(resolution) {
	var m;

	if ((m = resolution.match(/^([1-9][0-9]*)d$/))) {
		return ~~m[1] * 24 * 3600;
	}

	if ((m = resolution.match(/^([1-9][0-9]*)h$/))) {
		return ~~m[1] * 3600;
	}

	if ((m = resolution.match(/^([1-9][0-9]*)m$/)))	{
		return ~~m[1] * 60;
	}

	if ((m = resolution.match(/^([1-9][0-9]*)s?$/))) {
		return ~~m[1];
	}

	return 1;
}


exports.setup = function (state, cb) {
	var requiredContexts = mithril.core.config.get('module.score.contexts') || [];
	if (requiredContexts.length === 0) {
		return cb();
	}

	// find already existing contexts

	var query = 'SELECT id, name FROM score_context';
	var params = [];

	state.datasources.db.getMany(query, params, null, function (error, results) {
		if (error) {
			return cb(error);
		}

		var len = results.length;
		for (var i = 0; i < len; i++) {
			var row = results[i];

			for (var j = 0, jlen = requiredContexts.length; j < jlen; j++) {
				var context = requiredContexts[j];

				if (context.name === row.name) {
					contextMap[context.name] = { id: row.id, resolution: parseResolution(context.resolution) };
				}
			}
		}

		var missingContexts = requiredContexts.filter(function (context) {
			return !(context.name in contextMap);
		});

		if (missingContexts.length === 0) {
			return cb();
		}

		// insert the non existing contexts

		// TODO: this does not scale well, better do like what we do with currencies (INSERT IGNORE)

		async.forEachSeries(
			missingContexts,
			function (context, callback) {
				var sql = 'INSERT INTO score_context VALUES(NULL, ?)';
				var params = [context.name];

				state.datasources.db.exec(sql, params, null, function (error, info) {
					if (error) {
						return callback(error);
					}

					contextMap[context] = { id: info.insertId, resolution: parseResolution(context.resolution) };

					callback();
				});
			},
			function (error) {
				cb(error);
			}
		);
	});
};


exports.awardPoints = function (state, actorIds, contextName, points, cb) {
	var context = contextMap[contextName];
	if (!context) {
		return state.error(null, 'Score context ' + contextName + ' not found.', cb);
	}

	if (!(actorIds instanceof Array)) {
		return state.error(null, 'Actor IDs not an array.', cb);
	}

	var count = actorIds.length;

	if (count === 0) {
		return cb();
	}

	var time = mithril.core.time;

	// scale down the resolution of time if required in this context

	if (context.resolution > 1) {
		time = ~~(time / context.resolution) * context.resolution;
	}

	var values = [];
	var params = [];

	for (var i = 0; i < count; i++) {
		values.push('(?, ?, ?, ?)');
		params.push(actorIds[i], context.id, time, points);
	}

	var db = state.datasources.db;

	var sql = 'INSERT INTO score_log VALUES ' + values.join(', ') + ' ON DUPLICATE KEY UPDATE points = points + VALUES(points)';

	db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		var values = [];
		var params = [];

		for (var i = 0; i < count; i++) {
			values.push('(?, ?, ?)');
			params.push(actorIds[i], context.id, points);
		}

		var sql = 'INSERT INTO score_total VALUES ' + values.join(', ') + ' ON DUPLICATE KEY UPDATE score = score + VALUES(score)';

		db.exec(sql, params, null, function (error) {
			if (error) {
				return cb(error);
			}

			var sql = 'SELECT actor, score FROM score_total WHERE context = ? AND actor IN (' + db.getPlaceHolders(actorIds.length) + ')';
			var params = [context.id].concat(actorIds);

			db.getMany(sql, params, null, function (error, results) {
				if (error) {
					return cb(error);
				}

				for (var i = 0, len = results.length; i < len; i++) {
					var row = results[i];

					state.emit(row.actor, 'score.total.edit', { to: row.score });
				}

				cb();
			});
		});
	});
};


exports.getLatestRankingListByContext = function (state, contextName, listName, cb) {
	var context = contextMap[contextName];
	if (!context) {
		return state.error(null, 'Score context ' + contextName + ' not found.', cb);
	}

	var query = "SELECT id, name, context FROM score_rankinglist WHERE context = ? AND name = ? ORDER BY creationTime DESC LIMIT 1";
	var params = [context.id, listName];

	state.datasources.db.getOne(query, params, false, null, cb);
};


exports.getRankingListById = function (state, id, cb) {
	// TODO: untested

	// this does not load the ranks, only the ranking list meta data

	var query = 'SELECT id, name, context FROM score_rankinglist WHERE id = ?';
	var params = [id];

	state.datasources.db.getOne(query, params, true, null, cb);
};


exports.getRankingLists = function (state, context, name, cb) {
	// both context and name are optional
	// this does not load the ranks
	// TODO

	state.error(null, 'getRankingLists() is not yet implemented', cb);
};


exports.getRankingData = function (state, id, range, cb) {
	// loads the latest ranking list
	// this loads the full ranks - range is like: { from: min, to: max }

	var query = 'SELECT gp.level, srs.rank, srs.score, ad.actor, ad.value AS name FROM `score_rankinglist_ranks` AS srs JOIN `actor_data` AS ad ON srs.actor = ad.actor LEFT JOIN `game_playerstate` AS gp ON gp.player = ad.actor WHERE ad.property = ? AND srs.rankinglist = ?';

	var params = ['name', id];

	if (range) {
		query += ' AND srs.rank BETWEEN ? AND ?';
		params.push(range.from);
		params.push(range.to);
	}

	state.datasources.db.getMany(query, params, null, cb);
};


exports.getRankingDataByActor = function (state, actorId, rankingListId, cb) {
	var query = 'SELECT srs.rank, srs.score, ad.actor, ad.value AS name FROM score_rankinglist_ranks AS srs JOIN actor_data AS ad ON srs.actor = ad.actor WHERE ad.property = ? AND srs.rankinglist = ? AND ad.actor = ? AND ad.language IN (?, ?)';
	var params = ['name', rankingListId, actorId, '', state.language()];

	state.datasources.db.getOne(query, params, false, null, cb);
};


exports.getRankingDataByActors = function (state, actorIds, rankingListId, cb) {
	var db = state.datasources.db;

	var query = 'SELECT srs.rank, srs.score, ad.actor, ad.value AS name FROM score_rankinglist_ranks AS srs JOIN actor_data AS ad ON srs.actor = ad.actor WHERE ad.property = ? AND srs.rankinglist = ? AND ad.language IN (?, ?) AND ad.actor IN (' + db.getPlaceHolders(actorIds.length) + ')';
	var params = ['name', rankingListId, '', state.language()].concat(actorIds);

	db.getMapped(query, params, { key: 'actor' }, null, cb);
};


exports.getFullRankingLists = function (state, context, name, onlyLatest, cb) {
	// both context and name are optional
	// this loads the full ranks

	// TODO
};


exports.getFullRankingList = function (state, id, cb) {
	// this loads a complete ranking list with its ranks

	// TODO
};


function generateRankingList(state, rankingListId, context, interval, cb) {
	state.datasources.db.exec('SET @N = 0', [], null, function (error, info) {
		if (error) {
			return cb(error);
		}

		var sql = 'INSERT INTO score_rankinglist_ranks SELECT ?, @N := @N + 1, actor, SUM(points) AS total FROM score_log WHERE ';
		var params = [rankingListId];
		var where = [];
		var order = ['total ' + context.order];

		if (interval) {
			where.push('receivedTime BETWEEN ? AND ?');
			params.push(interval.from, interval.until - 1);
		}

		where.push('context = ?');
		params.push(context.id);

		sql += where.join(' AND ') + ' GROUP BY actor ORDER BY ' + order.join(', ');

		state.datasources.db.exec(sql, params, null, cb);
	});
}


function generateEqualizedRankingList(state, rankingListId, firstContext, secondContext, interval, cb) {
	// makes a ranking of all scores between interval.from (inclusive) and interval.until (exclusive)
	// interval is optional
	// firstContext and secondContext: { id: contextId, order: 'ASC/DESC' } (required)

	state.datasources.db.exec('SET @N = 0', [], null, function (error) {
		if (error) {
			return cb(error);
		}

		var sql = 'INSERT INTO score_rankinglist_ranks SELECT ?, @N := @N + 1, scores.actor, scores.total FROM (SELECT actor, SUM(IF(context = ?, points, 0)) AS total, SUM(IF(context = ?, points, 0)) AS equalizer FROM score_log WHERE ';
		var where = ['context IN (?, ?)'];
		var params = [rankingListId, firstContext.id, secondContext.id, firstContext.id, secondContext.id];
		var order = ['scores.total ' + (firstContext.order || 'DESC'), 'scores.equalizer ' + (secondContext.order || 'DESC')];

		if (interval) {
			where.push('receivedTime BETWEEN ? AND ?');
			params.push(interval.from, interval.until - 1);
		}

		sql += where.join(' AND ') + ' GROUP BY actor) AS scores ORDER BY ' + order.join(', ');

		state.datasources.db.exec(sql, params, null, cb);
	});
}


exports.generateRankingList = function (state, contextName, name, ascending, interval, equalizer, cb) {
	// makes a ranking of all scores between interval.from (inclusive) and interval.until (exclusive)
	// interval and ascending are optional

	// equalizer: { context: 'name', ascending: true/false }

	var context = contextMap[contextName];
	if (!context) {
		return state.error(null, 'Score context ' + contextName + ' not found.', cb);
	}

	var sql = 'INSERT INTO score_rankinglist VALUES(NULL, ?, ?, ?)';
	var params = [context.id, name, mithril.core.time];

	state.datasources.db.exec(sql, params, null, function (error, info) {
		if (error) {
			return cb(error);
		}

		var rankingListId = info.insertId;

		// create the list

		var callback = function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, rankingListId);
		};


		var firstContext = { id: context.id, order: ascending ? 'ASC' : 'DESC' };

		if (equalizer) {
			var eqContext = contextMap[equalizer.context];

			var secondContext = { id: eqContext.id, order: equalizer.ascending ? 'ASC' : 'DESC' };

			generateEqualizedRankingList(state, rankingListId, firstContext, secondContext, interval, callback);
		} else {
			generateRankingList(state, rankingListId, firstContext, interval, callback);
		}
	});
};


exports.delRankingList = function (state, id, cb) {
	// TODO
};


exports.delOldRankingLists = function (state, olderThanTime, cb) {
	// TODO
};

