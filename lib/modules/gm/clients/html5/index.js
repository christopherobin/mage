(function () {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.gm.construct'));

	mithril.io.registerCommandHook('gm.admin', function (messageData) {
		return {};
	});

/*
	if (!window.tool) {
		window.tool = {};
	}

	mod.extensions = {};

	mod.extend = function (sourceMod, extensions, cb) {
		for (var i = 0, len = extensions.length; i < len; i++) {

			var extension;

			var toolName = extensions[i].target;
			var extendFn = extensions[i].extend;
			var options  = extensions[i].options;

			if (mithril[toolName]) {
				if (!mithril[toolName].extensions) 
					mithril[toolName].extensions = {};
				}

				if (!mithril[toolName].extensions[sourceMod]) {
					extendFn(mithril[toolName].extensions[sourceMod], options, cb);
				} else {
					console.warn('Module ' + toolName + ' has already been extended by module ' + sourceMod + '.');
				}
			}

		}
	};
*/
}());
