var assert = require('assert');

/* envelope format:
 * [  ]
 *
 */


/* meta format:
 *   1 byte: data position
 *   1 byte: flags
 *   N bytes: message type
 */

var flagsByStr = {
	NONE: 0,
	REPLY_EXPECTED: 1
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

	console.trace('Envelope of type', this.type, 'for route', this.route.map(String), 'with returnRoute', this.returnRoute.map(String));
}

module.exports = Envelope;


Envelope.prototype.setMessage = function (type, message) {
	assert(type, 'An envelope must have a type');

	this.type = type;

	if (!message) {
		this.message = new Buffer(0);
		return;
	}

	if (typeof message === 'string') {
		this.message = new Buffer(message);
		return;
	}

	if (!Buffer.isBuffer(message) && typeof message.toBuffer === 'function') {
		this.message = message.toBuffer();
		return;
	}

	if (Buffer.isBuffer(message)) {
		this.message = message;
		return;
	}

	throw new TypeError('Message must be a Buffer');
};


Envelope.prototype.setRoute = function (route) {
	if (typeof route === 'string') {
		route = [route];
	}

	this.route = route;

	if (this.meta) {
		this.meta[0] = this.route.length;
	}
};


Envelope.prototype.setReturnRoute = function (route) {
	if (typeof route === 'string') {
		route = [route];
	}

	this.returnRoute = route || [];
};


Envelope.prototype.setMeta = function (flags) {
	var type = new Buffer(this.type);

	this.meta = new Buffer(2 + type.length);
	this.meta[0] = this.route.length;
	this.meta[1] = flagsToInt(flags);

	type.copy(this.meta, 2);
};


Envelope.fromArgs = function (args) {
	args = Array.prototype.slice.call(args);
	console.trace('RECEIVED ARGS', args.map(String));

	var meta = args.pop();
	var messageIndex = meta[0];
	var flags = meta[1];
	var type = meta.toString('utf8', 2);

	var message = args[messageIndex];
	var route = args.slice(0, messageIndex);
	var returnRoute = args.slice(messageIndex + 1);

	console.log('MESSAGE', message);
	console.log('ROUTE', route.map(String));
	console.log('RETURN ROUTE', returnRoute.map(String));
	return new Envelope(type, message, route, returnRoute, flags);
};


Envelope.prototype.toArgs = function () {
	return this.route.concat(this.message, this.returnRoute, this.meta);
};


Envelope.prototype.consumeRoute = function (identity) {
	var hasConsumed = false;

	identity = String(identity);

	while (String(this.route[0]) === identity) {
		this.route.shift();
		hasConsumed = true;
	}

	this.meta[0] = this.route.length;

	return hasConsumed;
}

Envelope.prototype.routeRemains = function () {
	return this.route.length > 0;
};


Envelope.prototype.injectSender = function (sender) {
	this.returnRoute = [sender].concat(this.returnRoute);
};


Envelope.prototype.isFlagged = function (flagCode) {
	var flagNum = flagsByStr[flagCode];

	return (this.meta[1] & flagNum === flagNum);
};


Envelope.prototype.getFlags = function () {
	return flagsToStrArray(this.meta[1]);
};
