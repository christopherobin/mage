var mithril = require('../../mithril');


// queryable model structure

exports.getManageCommands = function () {
	return ['sync'];
};


exports.getActor = function (state, id, cb) {
	id = id >>> 0;

	var query = 'SELECT creationTime FROM actor WHERE id = ?';
	var params = [id];

	state.datasources.db.getOne(query, params, true, null, function (error, actor) {
		if (error) {
			return cb(error);
		}

		actor.id = id;

		cb(null, actor);
	});
};


exports.addActor = function (state, name, cb) {
	// name may be:
	//   string
	//   { lang: string, lang: string, ..., lang: string }

	var time = mithril.core.time;

	var sql = 'INSERT INTO actor (creationTime) VALUES (?)';
	var params = [time];

	state.datasources.db.exec(sql, params, null, function (error, info) {
		if (error) {
			return cb(error);
		}

		var actorId = info.insertId;
		var actor = { id: actorId, creationTime: time, data: {} };

		if (!name) {
			return cb(null, actor);
		}

		exports.getActorProperties(state, actorId, {}, function (err, properties) {
			if (typeof name === 'string') {
				properties.set('name', name);
				actor.data.name = name;
			} else {
				for (var language in name) {
					properties.set('name', name[language], language);

					if (language === state.language()) {
						actor.data.name = name[language];
					}
				}
			}

			properties.save(function (err) {
				if (err) {
					return cb(err);
				}

				cb(null, actor);
			});
		});
	});
};


exports.getActorProperties = function (state, actorId, options, cb) {
	var config = {
		domain: 'actor/' + actorId
	};

	mithril.core.LivePropertyMap.create(state, config, options, cb);
};


exports.delActor = function (state, id, cb) {
	// TODO: removing an actor involves more than just this record. Eg: objects would remain intact.
	// TODO: remove property map!

	var sql = 'DELETE FROM actor WHERE id = ?';
	var params = [id];

	state.datasources.db.exec(sql, params, null, cb);
};

