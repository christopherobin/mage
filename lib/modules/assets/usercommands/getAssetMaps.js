var mithril = require('../../../mithril');

exports.params = ['names'];

exports.execute = function (state, names, cb) {
	names = names || [];
	var newMaps = {};
	var maps = mithril.assets.getAssetMaps(names);

	for (var name in maps) {
		map = maps[name];
		var newMap = {};
		for (var type in map.assets) {
			var baseUrl = map.baseUrl[type];
			var typeMap = map.assets[type];
			var assets  = {};

			for (var asset in typeMap) {
				assets[asset] = baseUrl + typeMap[asset][0].path.replace(/\$0/, asset);
			}

			newMap[type] = assets;
		}

		newMaps[name] = newMap;
	}

	state.respond(newMaps);
	cb();
};
