(function () {

	var mage = window.mage;

	var mod = mage.helpers = {};

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
