(function () {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.actor.construct'));


	function Actor(obj) {
		this.id = obj.id;
		this.creationTime = obj.creationTime;

		this.initPropertyMap('actor/' + this.id, obj.data);
	}

	Actor.prototype = new mithril.data.PropertyMap();


	mod.setup = function (cb) {
		if (!mod.sync) {
			return cb();
		}

		mod.sync(function (error, result) {
			if (error) {
				return cb(error);
			}

			mod.me = new Actor(result.me);

			cb();
		});
	};

}());
