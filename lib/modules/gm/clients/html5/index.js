(function () {

	var mage = window.mage;
	var mod = mage.registerModule($html5client('module.gm.construct'));

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
