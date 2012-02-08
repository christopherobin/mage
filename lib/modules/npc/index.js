var mithril = require('../../mithril'),
	LivePropertyMap = mithril.core.LivePropertyMap,
    objToJson = mithril.core.helpers.objToJson,
    async = require('async');

exports.getManageCommands = function () {
	return ['sync', 'addNpc', 'editNpc', 'delNpc'];
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


exports.addNpc = function (state, identifier, data, cb) {
	var id = null;
	async.waterfall([
		function (callback) {
			var sql = 'INSERT INTO npc (identifier) values (?)';
			var params = [identifier];

			state.datasources.db.exec(sql, params, null, function (error, info) {
				if (error) {
					return callback(error);
				}
				id = info.insertId;
				callback();
			});
		},
		function (callback) {
			var addSql = 'INSERT INTO npc_data (npc, property, language, type, value) VALUES (?, ?, ?, ?, ?)';
			var paramData = flattenProperties(data);

			async.forEachSeries(paramData, function (property, propCb) {
				var addParams = [id, property.property, property.language || '', property.type, property.value];
				state.datasources.db.exec(addSql, addParams, null, propCb);
			}, callback);
		},
		function (callback) {
			exports.loadNpcs(state, callback);
		}
	], function (err) {
		if (err) {
			return cb(err);
		}
		cb(null, id);
	});
};


exports.editNPC = function (state, id, identifier, data, cb) {
	async.waterfall([
		function (callback) {
			var sql = 'UPDATE npc SET identifier = ? WHERE id = ?';
			var params = [identifier, id];

			state.datasources.db.exec(sql, params, null, function (error) {
				if (error) {
					return callback(error);
				}
				callback();
			});
		},
		function (callback) {

			var clearSql  = 'DELETE FROM npc_data WHERE npc = ?';
			var addSql    = 'INSERT INTO npc_data (npc, property, language, type, value) VALUES (?, ?, ?, ?, ?)';
			var paramData = flattenProperties(data);

			async.series([
				function (dataCb) {
					state.datasources.db.exec(clearSql, [id], null, dataCb);
				},
				function (dataCb) {
					async.forEachSeries(paramData, function (property, propCb) {
						var addParams = [id, property.property, property.language || '', property.type, property.value];
						state.datasources.db.exec(addSql, addParams, null, propCb);
					}, dataCb);
				}
			], callback);
		},
		function (callback) {
			exports.loadNpcs(callback);
		}
	], function (error) {
		if (error) {
			return cb(error);
		}
		cb();
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
