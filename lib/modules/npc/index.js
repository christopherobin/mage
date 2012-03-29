var mithril = require('../../mithril'),
	LivePropertyMap = mithril.core.LivePropertyMap,
    objToJson = mithril.core.helpers.objToJson,
    async = require('async');

exports.getManageCommands = function () {
	return ['sync', 'replaceNpc', 'delNpc'];
};


// a list of NPCs per language for quick lookup in any language

var npcsArr = [];
var npcsMap = {};


exports.setup = function (state, cb) {
	// preload all NPCs

	exports.loadNpcs(state, function (error, arr, map) {
		if (error) {
			return cb(error);
		}

		npcsArr = arr;
		npcsMap = map;

		cb();
	});
};


exports.getAll = function () {
	return npcsArr;
};


exports.getNpc = function (identifier) {
	return npcsMap[identifier] || null;
};


exports.loadNpcs = function (state, cb) {
	var query = 'SELECT actor, identifier FROM npc';
	var params = [];

	state.datasources.db.getMany(query, params, null, function (error, npcs) {
		if (error) {
			return cb(error);
		}

		var query = 'SELECT npc, property, language, type, value FROM npc_data';
		var params = [];

		state.datasources.db.getMany(query, params, null, function (error, data) {
			if (error) {
				return cb(error);
			}

			var npcsLen = npcs.length;
			var dataLen = data.length;
			var map = {};
			var npc;

			for (var i = 0; i < npcsLen; i++) {
				npc = npcs[i];

				npc.data = new mithril.core.PropertyMap();

				map[npc.identifier] = npc;
			}

			for (i = 0; i < dataLen; i++) {
				var prop = data[i];

				for (var j = 0; j < npcsLen; j++) {
					npc = npcs[j];

					if (npc.actor === prop.npc) {
						npc.data.importOne(prop.property, prop.type, prop.value, prop.language);
					}
				}
			}

			cb(null, npcs, map);
		});
	});
};


var syncCache = {};


exports.getSyncData = function (language) {
	var result = syncCache[language];
	if (result) {
		return result;
	}

	var npcs = npcsArr;
	var len = npcs.length;

	result = new Array(len);

	for (var i = 0; i < len; i++) {
		var npc = npcs[i];

		result[i] = {
			actor: npc.actor,
			identifier: npc.identifier,
			data: npc.data.getAll(language)
		};
	}

	result = JSON.stringify(result);

	syncCache[language] = result;

	return result;
};


function addNpc(state, identifier, cb) {
	var sql = 'SELECT actor FROM npc WHERE identifier = ?';
	state.datasources.db.getOne(sql, [identifier], false, null, function (err, result) {
		if (err) {
			return cb(err);
		}

		var id = result && result.actor;


		if (!id) {
			var actorSql = 'INSERT INTO actor (id, creationTime) VALUES (null, ?)';
			var npcSql   = 'INSERT INTO npc (actor, identifier) VALUES (?, ?)';

			state.datasources.db.exec(actorSql, [new Date().getTime() / 1000], null, function (err, result) {
				if (err) {
					return cb(err);
				}

				id = result.insertId;
				state.datasources.db.exec(npcSql, [id, identifier], null, function (err, result) {
					if (err) {
						return cb(err);
					}

					return cb(null, id);
				});
			});
		} else {
			return cb(null, id);
		}
	});
}


function replaceNpcData(state, npcId, properties, cb) {
	var delSql      = 'DELETE FROM npc_data WHERE npc = ?';
	var sql         = 'INSERT INTO npc_data (npc, property, language, type, value) VALUES ';
	var frag        = [];
	var dataParams  = [];
	var len         = properties.length;


	state.datasources.db.exec(delSql, [npcId], null, function (err, result) {
		if (err) {
			return cb(err);
		}


		if (len === 0) {
			return cb();
		}

		for (var i = 0; i < len; i++) {
			var property = properties[i];
			frag.push('(?, ?, ?, ?, ?)');
			dataParams.push(npcId, property.property, property.language || '', property.type, property.value);
		}

		sql += frag.join(', ');

		state.datasources.db.exec(sql, dataParams, null, cb);
	});
}


exports.replaceNpc = function (state, identifier, properties, cb) {
	addNpc(state, identifier, function (err, npcId) {
		if (err) {
			return cb(err);
		}

		replaceNpcData(state, npcId, properties, cb);
	});
};


exports.delNpc = function (state, id, cb) {

	//TODO: implement del.

	exports.loadNpcs(function (err) {
		if (err) {
			return cb(err);
		}
		cb();
	});
};
