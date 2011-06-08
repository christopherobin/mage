// a list of NPCs per language for quick lookup in any language

var npcsArr = [];


exports.setup = function(state, cb)
{
	// preload all NPCs

	exports.loadNpcs(state, function(error, npcs) {
		if (error) return cb(error);

		npcArr = npcs;
		cb();
	});
};


exports.loadNpcs = function(state, cb)
{
	var sql = 'SELECT actor, identifier FROM npc';
	var params = [];

	state.datasources.db.getMany(sql, params, null, function(error, npcs) {
		if (error) return cb(error);

		sql = 'SELECT npc, property, language, value FROM npc_data';
		params = [];

		state.datasources.db.getMany(sql, params, null, function(error, data) {
			if (error) return cb(error);

			var npcsLen = npcs.length;
			var dataLen = data.length;

			for (var i=0; i < npcsLen; i++)
			{
				npcs[i].data = new mithril.core.PropertyMap();
			}

			for (var i=0; i < dataLen; i++)
			{
				var prop = data[i];

				for (var j=0; j < npcsLen; j++)
				{
					if (npcs[j].actor != prop.npc) continue;

					npcs[j].data.addOne(prop.property, prop.language, prop.value);
				}
			}

			cb(null, npcs);
		});
	});
};

