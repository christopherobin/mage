// data type classes are expected to implement:
//   getRaw()
//   setRaw(object)
// in order to serialize from/to datastores.

var mithril = require('../mithril');

var types = {};


exports.registerType = function (name, path) {
	exports[name] = types[name] = require(path);
};


// register pre-included types

exports.registerType('TimedValue',  './timedValue');
exports.registerType('TimedNumber', './timedNumber');


exports.createValue = function (typeName, obj) {
	var TypeClass = types[typeName];

	if (TypeClass) {
		var baseCfg = { __type: typeName };

		var o = new TypeClass(baseCfg);

		if (obj) {
			o.setRaw(obj);
		}

		return o;
	}

	mithril.core.logger.error('Unrecognized data type:', typeName);
	return null;
};

