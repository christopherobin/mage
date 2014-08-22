var assert = require('assert');
var nullBuffer = new Buffer(0);

/* envelope format:
 * [identity, .., identity, 0, message, .., message, 0, returnIdentity, .., returnIdentity, meta]
 */


/* meta format:
 *   1 byte: flags
 *   N bytes: message type
 */

var flagsByStr = {
	NONE: 0,
	TRACK_ROUTE: 1
};

function flagsToInt(flags) {
	if (flags === null || flags === undefined) {
		return 0;
	}

	if (typeof flags === 'number') {
		return flags;
	}

	if (typeof flags === 'string') {
		return flagsByStr[flags];
	}

	if (Array.isArray(flags)) {
		var num = 0;

		for (var i = 0; i < flags.length; i += 1) {
			num |= flagsToInt(flags[i]);
		}

		return num;
	}

	throw new TypeError('Unrecognized flags type: ' + flags);
}


function flagsToStrArray(flags) {
	var result = [];
	var flagNames = Object.keys(flagsByStr);
	for (var i = 0; i < flagNames.length; i += 1) {
		var flagName = flagNames[i];

		if (flags & flagsByStr[flagName] > 0) {
			result.push(flagName);
		}
	}

	return result;
}


function Envelope(type, message, route, returnRoute, flags) {
	this.setRoute(route);
	this.setReturnRoute(returnRoute);

	this.setMessage(type, message);
	this.setMeta(flags);
}

module.exports = Envelope;


Envelope.prototype.setMessage = function (type, message) {
	assert(type, 'An envelope must have a type');

	this.type = type;
	this.messages = [];

	if (Array.isArray(message)) {
		for (var i = 0; i < message.length; i += 1) {
			this.addMessage(message[i]);
		}
	} else {
		this.addMessage(message);
	}
};


Envelope.prototype.addMessage = function (message) {
	if (!message) {
		return;
	}

	if (Buffer.isBuffer(message)) {
		this.messages.push(message);
		return;
	}

	if (typeof message === 'string') {
		this.messages.push(new Buffer(message));
		return;
	}

	if (typeof message.toBuffer === 'function') {
		this.messages.push(message.toBuffer());
		return;
	}

	throw new TypeError('Message must be a Buffer or string');
};


Envelope.prototype.setRoute = function (route) {
	if (typeof route === 'string') {
		this.route = [route];
	} else if (Array.isArray(route)) {
		this.route = route.slice();  // make a fresh copy
	} else if (!route) {
		this.route = [];
	} else {
		throw new TypeError('Route must be an array');
	}
};


Envelope.prototype.setReturnRoute = function (route) {
	if (typeof route === 'string') {
		this.returnRoute = [route];
	} else if (Array.isArray(route)) {
		this.returnRoute = route.slice();  // make a fresh copy
	} else if (!route) {
		this.returnRoute = [];
	} else {
		throw new TypeError('ReturnRoute must be an array');
	}
};


Envelope.prototype.setMeta = function (flags) {
	var type = new Buffer(this.type);

	this.meta = new Buffer(1 + type.length);
	this.meta[0] = flagsToInt(flags);

	type.copy(this.meta, 1);
};


/**
 *
 * @param args
 * @param [senderIdentity]  A router may provide this
 * @returns {Envelope}
 */

Envelope.fromArgs = function (args, senderIdentity) {
	args = Array.prototype.slice.call(args);

	if (senderIdentity) {
		senderIdentity = String(senderIdentity);
	}

	var meta = args.pop();
	var flags = meta[0];
	var type = meta.toString('utf8', 1);

	var shouldTrackRoute = ((flags & flagsByStr.TRACK_ROUTE) !== 0);
	var route = [];
	var message = [];
	var returnRoute = [];
	var expect = 'route';

	for (var i = 0; i < args.length; i += 1) {
		var arg = args[i];

		if (expect === 'route') {
			if (arg.length === 0) {
				expect = 'message';
				continue;
			}

			route.push(String(arg));
		}

		if (expect === 'message') {
			if (arg.length === 0) {
				expect = 'returnRoute';

				if (senderIdentity && shouldTrackRoute) {
					returnRoute.push(senderIdentity);
				}

				continue;
			}

			message.push(arg);
		}

		if (expect === 'returnRoute') {
			if (shouldTrackRoute) {
				arg = String(arg);

				if (returnRoute[0] !== arg) {
					returnRoute.push(arg);
				}
			}
		}
	}

	return new Envelope(type, message, route, returnRoute, flags);
};


Envelope.prototype.toArgs = function () {
	return this.route.concat(nullBuffer, this.messages, nullBuffer, this.returnRoute, this.meta);
};


Envelope.prototype.consumeRoute = function (identity) {
	var hasConsumed = false;

	identity = String(identity);

	while (String(this.route[0]) === identity) {
		this.route.shift();
		hasConsumed = true;
	}

	return hasConsumed;
};


Envelope.prototype.getFinalDestination = function () {
	return this.route[this.route.length - 1];
};


Envelope.prototype.getInitialSource = function () {
	return this.returnRoute[this.returnRoute - 1];
};


Envelope.prototype.routeRemains = function () {
	return this.route.length > 0;
};


Envelope.prototype.injectSender = function (sender) {
	this.returnRoute = [sender].concat(this.returnRoute);
};


Envelope.prototype.isFlagged = function (flagCode) {
	var flagNum = flagsByStr[flagCode];

	return (this.meta[0] & flagNum === flagNum);
};


Envelope.prototype.getFlags = function () {
	return flagsToStrArray(this.meta[0]);
};


Envelope.prototype.setFlag = function (flag) {
	this.meta[0] |= flagsToInt(flag);
};
