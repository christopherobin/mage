var mithril = require('../../mithril');


// queryable model structure

exports.getManageCommands = function () {
	return ['sync', 'getActorData', 'editActor'];
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


exports.findActor = function (state, id, cb) {
	id = id >>> 0;

	var query = 'SELECT creationTime FROM actor WHERE id = ?';
	var params = [id];

	state.datasources.db.getOne(query, params, false, null, function (error, actor) {
		if (error) {
			return cb(error);
		}

		if (!actor) {
			return cb(null, null);
		}

		actor.id = id;

		cb(null, actor);
	});
};


exports.addActor = function (state, name, language, cb) {
	if (typeof language === 'function') {
		// for backwards compatibility

		cb = language;
		language = 'EN';
	}


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
			// write the language

			properties.set('language', language);
			actor.data.language = language;

			// write the name

			if (typeof name === 'string') {
				properties.set('name', name);
				actor.data.name = name;
			} else {
				for (var lang in name) {
					properties.set('name', name[lang], language);

					if (lang === state.language(language)) {
						actor.data.name = name[lang];
					}
				}
			}

			cb(null, actor);
		});
	});
};


exports.getActorProperties = function (state, actorId, options, cb) {
	var domain = {
		id: actorId,
		key: 'actor/' + actorId,
		events: { actorIds: [actorId] }
	};

	mithril.core.LivePropertyMap.create(state, domain, options, cb);
};


exports.getActorsProperties = function (state, actorIds, options, cb) {
	var len = actorIds.length;
	var domains = new Array(len);

	for (var i = 0; i < len; i++) {
		var actorId = actorIds[i];

		domains[i] = {
			id: actorId,
			key: 'actor/' + actorId,
			events: { actorIds: [actorId] }
		};
	}

	mithril.core.LivePropertyMap.createMany(state, domains, options, cb);
};


exports.delActor = function (state, id, cb) {
	// TODO: removing an actor involves more than just this record. Eg: objects would remain intact.
	// TODO: remove property map!

	var sql = 'DELETE FROM actor WHERE id = ?';
	var params = [id];

	state.datasources.db.exec(sql, params, null, cb);
};

