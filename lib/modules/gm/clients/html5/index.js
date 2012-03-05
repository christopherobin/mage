(function () {

	var mithril = window.mithril;
	var mod = mithril.registerModule($html5client('module.gm.construct'));

	mithril.io.registerCommandHook('gm.admin', function (messageData) {
		return {};
	});


	if (!window.tool) {
		window.tool = {};
	}

	mod.extensions = {};

	mod.extend = function (extensions, cb) {
		for (var i = 0, len = extensions.length; i < len; i++) {
			var extension = extensions[i];

			var type     = extension.type;
			var target   = extension.target;
			var name     = extension.name;
			var extendFn = extension.extendFn;

			if (!mod.extensions[type]) {
				mod.extensions[type] = {};
			}

			if (!mod.extensions[type][target]) {
				mod.extensions[type][target] = {};
			}

			if (mod.extensions[type][target][name]) {
				console.warn('Extenstion of type ', type, ', target = ', target, ' and name = ', name, ' already exists.');
				continue;
			}

			mod.extensions[type][target][name] = extendFn;
		}

		cb();
	};
}());
