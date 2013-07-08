/**
 * Make deep copies of stuff.
 *
 * @param  {*} a Something to copy.
 * @return {*}   The copy.
 */

function deepCopy(a) {
	// Deal with arrays before other kinds of objects.
	if (Array.isArray(a)) {
		return a.map(deepCopy);
	}

	// Null is a sketchy character. Deal with it before we hit objects.
	if (a === null) {
		return null;
	}

	// Remaining things that think they are objects should be treated like this.
	if (typeof a === 'object') {
		var keys = Object.keys(a);
		var toReturn = {};

		for (var i = 0; i < keys.length; i++) {
			toReturn[keys[i]] = deepCopy(a[keys[i]]);
		}

		return toReturn;
	}

	// Values can just be returned.
	return a;
}


/**
 * Recursively unpeel a matryoshka to recover the raw data.
 *
 * @param  {Matryoshka} matryoshka The matryoshka to unwrap.
 * @return {*}                     The raw representation of the data contained in the matryoshka.
 */

function getRaw(matryoshka) {
	var isMatryoshka = matryoshka instanceof Matryoshka;

	if (!isMatryoshka) {
		return matryoshka;
	}

	var type = matryoshka.getType();
	var value = matryoshka.getValue();

	if (type === 'object') {
		var returnObj = {};
		var keys = Object.keys(value);

		for (var i = 0; i < keys.length; i++) {
			returnObj[keys[i]] = getRaw(value[keys[i]]);
		}

		return returnObj;
	}

	return value;
}


/**
 * Make a matryoshka container for an some data. Objects are nested.
 *
 * @param {*}       value   Any value to be matryoshkaised.
 * @param {String}  source  The source of the data (a file path).
 * @param {Boolean} shallow Only wrap at the top level. For internal use only.
 */

function Matryoshka(value, source, shallow) {
	if (!(this instanceof Matryoshka)) {
		return new Matryoshka(value, source, shallow);
	}

	this.source = source;

	// Like Arrays, elements in objects are placed in containers.
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		this.type = 'object';

		if (shallow) {
			this.value = value;
			return this;
		}

		this.value = {};

		var keys = Object.keys(value);

		for (var j = 0; j < keys.length; j++) {
			this.value[keys[j]] = new Matryoshka(value[keys[j]], source);
		}

		return this;
	}

	// The remaining case includes the set of all scalar types, including arrays.
	this.value = value;
	this.type = 'scalar';

	return this;
}


/**
 * Simple getter. Nothing to see here.
 *
 * @return {*} Contained value.
 */

Matryoshka.prototype.getValue = function () {
	return this.value;
};


/**
 * Get the type of the matryoshka. The three types are:
 *
 *  - array
 *  - object
 *  - scalar
 *
 * These reflect the structure of the data. For example, null is not an object in this system, it is
 * a scalar. The types are exclusive, so arrays are not considered to be objects. This is to aid in
 * determining how copies are performed etc.
 *
 * @return {String} Matryoshka type.
 */

Matryoshka.prototype.getType = function () {
	return this.type;
};


/**
 * Return the array of sources for contained data.
 *
 * @return {Array} Data may have multiple sources, so sources are returned as an array.
 */

Matryoshka.prototype.getSource = function () {
	return this.source;
};


Matryoshka.prototype.tunnel = function (path) {
	function isString(val) {
		return typeof val === 'string';
	}

	if (!Array.isArray(path) || !path.every(isString)) {
		throw new TypeError('Addressing must be done with an array of strings');
	}

	var obj = this;

	// Dig down.
	for (var i = 0; i < path.length; i++) {
		if (!obj || !obj.getValue) {
			return;
		}

		var type = obj.getType();

		if (type !== 'object') {
			return obj.getValue();
		}

		obj = obj.getValue()[path[i]];
	}

	return obj && obj.getRaw ? obj : undefined;
};


/**
 * Get the raw form of configuration from a particular key down.
 *
 * @param  {Array} path A list of keys to dig into the abstact raw object.
 * @return {*}          The addressed raw value.
 */

Matryoshka.prototype.get = function (path, defaultVal) {
	var obj = this.tunnel(path);

	return obj === undefined ? defaultVal : obj.getRaw();
};


/**
 * Get the source of the configuration at some depth.
 */

Matryoshka.prototype.getSourceWithPath = function (path) {
	var obj = this.tunnel(path);

	return obj === undefined ? undefined : obj.getSource();
};


/**
 * Get the raw representation of the data in a matryoshka. As matryoshkas nest, this essentially
 * dematryoshkaises.
 *
 * @return {*} Get the raw value of something contained in a matryoshka. This is recursive.
 */

Matryoshka.prototype.getRaw = function () {
	return getRaw(this);
};


/**
 * A copy constructor in C++ parlance. Makes a complete copy. No references in common with original.
 *
 * @return {Matryoshka} A fresh, deep copy of the original matryoshka.
 */

Matryoshka.prototype.copy = function () {
	var value = this.getValue();
	var type = this.getType();
	var source = this.getSource();

	if (type === 'object') {
		var keys = Object.keys(value);
		var toReturn = {};

		for (var i = 0; i < keys.length; i++) {
			toReturn[keys[i]] = value[keys[i]].copy();
		}

		return new Matryoshka(toReturn, source, true);
	}

	// Non-objects are subjected to a deep copy (arrays are treated as values).
	return new Matryoshka(deepCopy(value), source, true);
};


/**
 * Merge two matryoshka instances to produce a third. This does not affect the parents in any way.
 *
 * @param  {Matryoshka} a A matryoshka of lower importance.
 * @param  {Matryoshka} b A matryoshka of higher importance.
 * @return {Matryoshka}   The resultant matryoshka.
 */

function mergeObjects(a, b) {
	if (a.getType() !== 'object' || b.getType() !== 'object') {
		throw new TypeError('Arguments must be non-null, non-array objects.');
	}

	var aValue = a.getValue();
	var bValue = b.getValue();

	var joinKeys = Object.keys(aValue);
	var bKeys = Object.keys(bValue);

	// Add keys from b.value that were not present in a.value;
	for (var k = 0; k < bKeys.length; k++) {
		var bKey = bKeys[k];

		if (joinKeys.indexOf(bKey) === -1) {
			joinKeys.push(bKey);
		}
	}

	var returnObj = {};

	// Compare each key-by-key.
	for (var m = 0; m < joinKeys.length; m++) {
		var key = joinKeys[m];

		returnObj[key] = merge(aValue[key], bValue[key]);
	}

	// Make a new matryoshka with the results.
	return new Matryoshka(returnObj, a.getSource(), true);
}


/**
 * Merges a and b together into a new Matryoshka. Does not affect the state of a or b, and b
 * overrides a.
 *
 * @param  {Matryoshka} a Matryoshka of lesser importance.
 * @param  {Matryoshka} b Matryoshka of greater importance.
 * @return {Matryoshka}   Resultant merge of a and b.
 */

function merge(a, b) {
	var aIsMatryoshka = a instanceof Matryoshka;
	var bIsMatryoshka = b instanceof Matryoshka;

	if (!aIsMatryoshka && !bIsMatryoshka) {
		throw new TypeError('Arguments must be matryoshka instances.');
	}

	// If a is not a matryoshka, then return a copy of b (override).
	if (!aIsMatryoshka) {
		return b.copy();
	}

	// If b is not a matryoshka, then just keep a.
	if (!bIsMatryoshka) {
		return a.copy();
	}

	// If we reached here, both a and b are matryoshkas.

	// Types are 'array', 'object' (not including array or null), 'scalar' (everything else).
	var aType = a.getType();
	var bType = b.getType();

	// Different types means that no merge is required, and we can just copy b.
	if (aType !== bType) {
		return b.copy();
	}

	// Scalar types are shallow, so a merge is really just an override.
	if (bType === 'scalar') {
		return b.copy();
	}

	// If we reached here, then both a and b are contain objects to be compared key-by-key.
	return mergeObjects(a, b);
}

// An extended merge. This can take any number of arguments, in order of increasing importance.
Matryoshka.merge = function () {
	if (arguments.length < 2) {
		throw new Error('Cannot merge less than two matryoshka.');
	}

	var merged = arguments[0].copy();

	for (var i = 1; i < arguments.length; i++) {
		merged = merge(merged, arguments[i]);
	}

	return merged;
};

// The Matryoshka constructor is exposed as the module. The shallow is bound out.
module.exports = Matryoshka;
