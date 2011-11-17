(function () {

	var mithril = window.mithril;

	var datatypes = mithril.datatypes = {};
	var types = {};


	datatypes.register = function (typeName, TypeClass) {
		types[typeName] = TypeClass;
		datatypes[typeName] = TypeClass;
	};


	datatypes.parse = function (obj) {
		if (obj) {
			var TypeClass = types[obj.__type];

			if (TypeClass) {
				var o = new TypeClass();
				o.setRaw(obj);
				return o;
			}
		}

		return obj;
	};


	datatypes.transformProperties = function (props) {
		if (props) {
			for (var key in props) {
				var value = props[key];

				if (value.__type) {
					props[key] = datatypes.parse(value);
				}
			}
		}
	};

}());
