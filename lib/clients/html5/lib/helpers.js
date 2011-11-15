(function () {

	var mithril = window.mithril;

	mithril.helpers = {};


	mithril.helpers.replaceObj = function (oldObject, newObject) {
		var key;

		for (key in oldObject) {
			delete oldObject[key];
		}

		for (key in newObject) {
			oldObject[key] = newObject[key];
		}
	};

}());
