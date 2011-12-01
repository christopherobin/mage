(function () {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.npc.construct'));

	var cache;


	function Npc(npc) {
		this.id = npc.actor;
		this.identifier = npc.identifier;
		this.data = npc.data;
	}


	mod.setup = function (cb) {
		mod.sync(function (errors, npcs) {
			if (errors) {
				return cb(errors);
			}

			cache = {};

			for (var i = 0, len = npcs.length; i < len; i++) {
				var npc = new Npc(npcs[i]);

				cache[npc.identifier] = npc;
			}

			cb();
		});
	};


	mod.getNpc = function (identifier, cb) {
		return cache[identifier] || null;
	};

}());
