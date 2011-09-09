var mithril = require('../../mithril');


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

