var serializeError = require('./errors.js');
var uniqueSelector = require('unique-selector');

var ErrorEvent = window.ErrorEvent;


function jsonSerialize(arg) {
	var RegExp = window.RegExp;
	var Node = window.Node;
	var Element = window.Element;
	var Window = window.Window;

	try {
		return JSON.stringify(arg);
	} catch (e) {
		// continue and deal with circular references
	}

	// serialize(obj) will turn obj into a JSON representation

	var reflist = [];

	function serialize(obj) {
		if (obj === undefined) {
			return JSON.stringify('<undefined>');
		}

		// class: Window

		if (Window && obj instanceof Window) {
			return JSON.stringify('[DOM Window]');
		}

		// class: Element (dom element, cannot be serialized without hazard)

		if (Element && obj instanceof Element) {
			return JSON.stringify('[DOM Element (' + uniqueSelector(obj) + ')]');
		}

		// class: Node (other dom nodes, cannot be serialized without hazard)

		if (Node && obj instanceof Node) {
			return JSON.stringify('[DOM Node (' + obj.nodeName + ')]');
		}

		// class: RegExp

		if (RegExp && obj instanceof RegExp) {
			// turn into a string

			return JSON.stringify('[RegExp (' + obj.toString() + ')]');
		}

		// array

		if (Array.isArray(obj)) {
			if (reflist.indexOf(obj) !== -1) {
				return JSON.stringify('[Circular reference]');
			}

			reflist.push(obj);

			return '[' + obj.map(serialize).join(',') + ']';
		}

		// object

		if (obj && typeof obj === 'object') {
			if (reflist.indexOf(obj) !== -1) {
				return JSON.stringify('[Circular reference]');
			}

			reflist.push(obj);

			var keys = Object.keys(obj);

			return '{' + keys.map(function (key) {
				return JSON.stringify(key) + ':' + serialize(obj[key]);
			}).join(',') + '}';
		}

		// scalar

		return JSON.stringify(obj);
	}

	return serialize(arg);
}


function serializeArgument(arg, data) {
	if (arg === undefined) {
		return 'undefined';
	}

	if (typeof arg === 'string') {
		return arg;
	}

	if (arg instanceof Error) {
		data.error = serializeError(arg);

		return arg.name + ': ' + arg.message;
	}

	if (ErrorEvent && arg instanceof ErrorEvent) {
		// ErrorEvent has "filename", "lineno", "message" and possibly "column"/"colno" and "error"
		//
		// The w3c says "column" and has no "error" property.
		// The whatwg says "colno" and adds the "error" property, which is the thrown object.
		//
		// For more information about the insanity, read the two different specifications at:
		//
		// - http://www.whatwg.org/specs/web-apps/current-work/multipage/webappapis.html#the-errorevent-interface
		// - http://www.w3.org/TR/html5/webappapis.html#the-errorevent-interface
		// - https://developer.mozilla.org/en-US/docs/Web/API/ErrorEvent

		data.filename = arg.filename;
		data.lineno = arg.lineno;
		data.colno = arg.colno || arg.column;

		if (arg.error && arg.error instanceof Error) {
			data.error = serializeError(arg.error);
		}

		return arg.message;
	}

	return jsonSerialize(arg);
}


module.exports = function serializeArguments(args) {
	var len = args.length;
	var out = new Array(len);
	var data = {};

	for (var i = 0; i < len; i++) {
		out[i] = serializeArgument(args[i], data);
	}

	var message = out.join(' ');

	if (Object.keys(data).length === 0) {
		data = null;
	}

	return { message: message, data: data };
};
