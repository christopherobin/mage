(function () {

	var mithril = window.mithril;

	var mod = mithril.helpers = {};

	mod.replaceObj = function (oldObject, newObject) {
		var key;

		for (key in oldObject) {
			delete oldObject[key];
		}

		for (key in newObject) {
			oldObject[key] = newObject[key];
		}
	};

}());
