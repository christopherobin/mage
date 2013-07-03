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

	switch (type) {
	case 'array':
		return value.map(getRaw);

	case 'object':
		var returnObj = {};
		var keys = Object.keys(value);

		for (var i = 0; i < keys.length; i++) {
			returnObj[keys[i]] = getRaw(value[keys[i]]);
		}

		return returnObj;

	default:
		return value;
	}
}


/**
 * Make a matryoshka container for an some data. Arrays and objects are nested.
 *
 * @param {Boolean} shallow Only wrap at the top level. For internal use only.
 * @param {*}       value   Any value to be matryoshkaised.
 * @param {String}  source  The source of the data (a file path).
 */

function Matryoshka(shallow, value, source) {
	if (!(this instanceof Matryoshka)) {
		return new Matryoshka(value, source);
	}

	this.source = [source];

	// Arrays remain arrays, but elements are placed in matryoshka containers.
	if (Array.isArray(value)) {
		this.type = 'array';

		if (shallow) {
			this.value = value;
			return this;
		}

		this.value = value.map(function (val) {
			return new Matryoshka(false, val, source);
		});


		return this;
	}

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
			this.value[keys[j]] = new Matryoshka(false, value[keys[j]], source);
		}

		return this;
	}

	// The remaining case includes the set of all scalar types.
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


/**
 * Get the raw form of configuration from a particular key down.
 *
 * @param  {Array} path A list of keys to dig into the abstact raw object.
 * @return {*}          The addressed raw value.
 */

Matryoshka.prototype.get = function (path, defaultVal) {
	function isString(val) {
		return typeof val === 'string';
	}

	if (!Array.isArray || !path.every(isString)) {
		throw new TypeError('Addressing must be done with an array of strings');
	}

	var obj = this;

	// Dig down.
	for (var i = 0; i < path.length; i++) {
		if (!obj.getValue) {
			return defaultVal;
		}

		var type = obj.getType();

		if (type !== 'object' || type !== 'array') {
			return defaultVal;
		}

		obj = obj.getValue()[path[i]];
	}

	return obj.getRaw();
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

	switch (type) {
	case 'array':
		return new Matryoshka(true, value.map(function (matryoshka) {
			return matryoshka.copy();
		}), source);

	case 'object':
		var keys = Object.keys(value);
		var toReturn = {};

		for (var i = 0; i < keys.length; i++) {
			toReturn[keys[i]] = value[keys[i]].copy();
		}

		return new Matryoshka(true, toReturn, source);

	default:
		return new Matryoshka(true, value, source);
	}
};


function mergeArrays(A, B) {
	if (A.getType() !== 'array' || B.getType() !== 'array') {
		throw new TypeError('Arguments must be non-null, non-array objects.');
	}

	var aValue = A.getValue();
	var bValue = B.getValue();

	var length = Math.max(aValue.length, bValue.length);
	var returnArray = [];
	var sources = [];

	for (var i = 0; i < length; i++) {
		var merged = merge(aValue[i], bValue[i]);
		returnArray.push(merged);

		var subSources = merged.getSource();

		for (var j = 0; j < subSources.length; j++) {
			if (sources.indexOf(subSources[j]) === -1) {
				sources.push(subSources[j]);
			}
		}
	}

	// A new matryoshka for the resulting array.
	return new Matryoshka(true, returnArray, sources.sort());
}

function mergeObjects(A, B) {
	if (A.getType() !== 'object' || B.getType() !== 'object') {
		throw new TypeError('Arguments must be non-null, non-array objects.');
	}

	var aValue = A.getValue();
	var bValue = B.getValue();

	var joinKeys = Object.keys(aValue);
	var bKeys = Object.keys(bValue);

	// Add keys from B.value that were not present in A.value;
	for (var k = 0; k < bKeys.length; k++) {
		var bKey = bKeys[k];

		if (joinKeys.indexOf(bKey) === -1) {
			joinKeys.push(bKey);
		}
	}

	var returnObj = {};
	var sources = [];

	// Compare each key-by-key.
	for (var m = 0; m < joinKeys.length; m++) {
		var key = joinKeys[m];
		var merged = merge(aValue[key], bValue[key]);

		returnObj[key] = merged;

		var subSources = merged.getSource();

		for (var n = 0; n < subSources.length; n++) {
			if (sources.indexOf(subSources[n]) === -1) {
				sources.push(subSources[n]);
			}
		}
	}

	// Make a new matryoshka with the results.
	return new Matryoshka(true, returnObj, sources.sort());
}


/**
 * Merges A and B together into a new Matryoshka. Does not affect the state of A or B, and B
 * overrides A.
 *
 * @param  {Matryoshka} A Matryoshka of lesser importance.
 * @param  {Matryoshka} B Matryoshka of greater importance.
 * @return {Matryoshka}   Resultant merge of A and B.
 */

function merge(A, B) {
	var aIsMatryoshka = A instanceof Matryoshka;
	var bIsMatryoshka = B instanceof Matryoshka;

	if (!aIsMatryoshka && !bIsMatryoshka) {
		throw new TypeError('Arguments must be matryoshka instances.');
	}

	// If A is not a matryoshka, then return a copy of B (override).
	if (!aIsMatryoshka) {
		return B.copy();
	}

	// If B is not a matryoshka, then just keep A.
	if (!bIsMatryoshka) {
		return A.copy();
	}

	// If we reached here, both A and B are matryoshkas.

	// Types are 'array', 'object' (not including array or null), 'scalar' (everything else).
	var aType = A.getType();
	var bType = B.getType();

	// Different types means that no merge is required, and we can just copy B.
	if (aType !== bType) {
		return B.copy();
	}

	// Scalar types are shallow, so a merge is really just an override.
	if (bType === 'scalar') {
		return B.copy();
	}

	// If both matryoshkas contain arrays, so they must be compared element-by-element.
	if (bType === 'array') {
		return mergeArrays(A, B);
	}

	// If we reached here, then both A and B are contain objects to be compared key-by-key.
	return mergeObjects(A, B);
}

// Append merge as a class function Matryoshka.merge.
Matryoshka.merge = merge;

// The Matryoshka constructor is exposed as the module. The shallow is bound out.
module.exports = Matryoshka.bind(null, false);
