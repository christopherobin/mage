var EventEmitter = require('events').EventEmitter;

exports = module.exports = new EventEmitter();

var mage;
var logger;
var Archivist;

var NO_DESCRIPTION = 'no description';


/**
 * To allow flexibility for testing, some objects are passed in with initialize.
 *
 * @param {Object}   mageInstance           A mage instance.
 * @param {Object}   mageLogger             A mage logger.
 * @param {Function} archivistConstructor   The archivist constructor.
 */

exports.initialize = function (mageInstance, mageLogger, archivistConstructor) {
	mage = mageInstance;
	logger = mageLogger;
	Archivist = archivistConstructor;
};


function State(actorId, session) {
	// behaves like a transaction, and will send off everything that happened after commit() is called.

	this.actorId = actorId ? ('' + actorId) : undefined;
	this.session = session || undefined;

	// available in user commands, gives you the name of the app where the command is running

	this.app = undefined;

	this.data = {};		// may be used to pass data around between functions
	this.description = null;

	this.archivist = new Archivist(this);

	// information for command response output:

	this.errorCode = undefined;
	this.response = undefined;
	this.myEvents = [];		// events for this session

	this.otherEvents = undefined;	// events for other actors: { actorId: [ list of events ], actorId: etc... }

	this.timeout = null;	// timeout
	exports.emit('created');
}


exports.State = State;


State.prototype.setTimeout = function (timeout) {
	this.clearTimeout();

	var that = this;

	this.timeout = setTimeout(function () {
		that.error(null, 'State timed out: ' + that.getDescription(), function () {
			that.close();
		});

		exports.emit('timeOut', timeout);
	}, timeout);
};


State.prototype.clearTimeout = function () {
	if (this.timeout) {
		clearTimeout(this.timeout);
		this.timeout = null;
	}
};


State.prototype.registerSession = function (session) {
	this.session = session;
	this.actorId = '' + session.actorId;
};


State.prototype.setDescription = function (description) {
	this.description = description;
};


State.prototype.getDescription = function () {
	return this.description || NO_DESCRIPTION;
};


State.prototype.emitEvents = function (cb) {
	// this function emits all events to players who are not state.actorId

	if (!this.otherEvents) {
		return cb();
	}

	var events = this.otherEvents;

	this.otherEvents = undefined;

	var actorIds = Object.keys(events);

	if (actorIds.length === 0) {
		return cb();
	}

	// pull addresses out of the session module

	if (!mage.session) {
		logger.warning('Cannot emit events to other actors without the "session" module set up.');
		return cb();
	}

	mage.session.getActorAddresses(this, actorIds, function (error, addresses) {
		if (error) {
			return cb(error);
		}

		// send events per address/actor

		for (var i = 0, len = addresses.length; i < len; i++) {
			var address = addresses[i];
			var actorId = address.actorId;
			var entries = events[actorId] || [];
			var language = address.language;
			var actorEvents = [];	// what we'll be emitting

			for (var j = 0, jlen = entries.length; j < jlen; j++) {
				var entry = entries[j];

				if (!entry.language || entry.language === language) {
					actorEvents.push(entry.evt);
				}
			}

			mage.core.msgServer.comm.send(address.addrName, address.host, '[' + actorEvents.join(',') + ']');
		}

		cb();
	});
};


State.prototype.language = function (fallback) {
	return this.session ? this.session.language : (fallback || 'EN');
};


State.prototype.emit = function (actorId, path, data, language, isJson) {
	// language may be omitted
	// if language is provided, it will only emit if the language matches the language used by actorId

	if (!actorId) {
		// it is possible (and valid) that emit() was called for an undefined actorId
		return;
	}

	var evt;

	if (!isJson) {
		data = JSON.stringify(data);
	}

	if (data === undefined) {
		evt = '["' + path + '"]';
	} else {
		evt = '["' + path + '",' + data + ']';
	}

	actorId = actorId + '';

	if (actorId === this.actorId) {
		// events for this.actorId

		if (!language || language === this.language()) {
			this.myEvents.push(evt);
		}
	} else {
		// events for other actors
		// language matches will be sorted out when we really emit them

		var entry = { evt: evt, language: language };

		if (!this.otherEvents) {
			this.otherEvents = {};
			this.otherEvents[actorId] = [entry];
		} else {
			var forActor = this.otherEvents[actorId];
			if (forActor) {
				forActor.push(entry);
			} else {
				this.otherEvents[actorId] = [entry];
			}
		}
	}
};


State.prototype.emitToActors = function (actorIds, path, data, language, isJson) {
	if (!actorIds) {
		return;
	}

	if (!Array.isArray(actorIds)) {
		actorIds = [actorIds];
	}

	var len = actorIds.length;

	if (len === 0) {
		return;
	}

	// remove duplicate actorIds

	// TODO: pre-sorting the actorIds and then comparing current id to previous might be a faster way to avoid duplicates

	var done = [];

	if (!isJson) {
		data = JSON.stringify(data);
	}

	for (var i = 0; i < len; i++) {
		var actorId = actorIds[i];

		if (!actorId) {
			continue;
		}

		actorId = actorId + '';

		if (done.indexOf(actorId) === -1) {
			this.emit(actorId, path, data, language, true);
			done.push(actorId);
		}
	}
};


State.prototype.error = function (code, logDetails, cb) {
	exports.emit('stateError');

	if (!code) {
		code = 'server';
	}

	var channel, args = [];

	var prefix = [];

	if (this.actorId) {
		prefix.push('Actor ' + this.actorId);
	}

	if (this.description) {
		prefix.push(this.description);
	}

	if (prefix.length > 0) {
		args.push('(' + prefix.join(', ') + ')');
	}

	if (logDetails) {
		channel = 'error';
		args.push(logDetails);
	} else {
		channel = 'debug';
		args.push('(error code: ' + JSON.stringify(code) + ')');
	}

	logger[channel].apply(logger, args);

	this.errorCode = code;

	if (cb && typeof cb === 'function') {
		cb(code);
	} else {
		logger.error('state.error() got called without a callback (' + this.getDescription() + ')');
	}
};


State.prototype.respond = function (response) {
	this.response = JSON.stringify(response);
};


State.prototype.respondJson = function (response) {
	this.response = response;
};


function closeWithError(state, cb) {
	cb(null, {
		errorCode: state.errorCode
	});
}


function closeWithSuccess(state, cb) {
	state.archivist.distribute(function (error) {
		// archivist errors can only come from the operations before writing anything to a vault,
		// (beforeDistribute hooks, operation validation, etc), so it is still safe to bail out and
		// report an error.

		if (error) {
			return closeWithError(state, cb);
		}

		state.emitEvents(function () {
			// create a response and return it to cb

			cb(null, {
				response: state.response,
				myEvents: state.myEvents.length ? state.myEvents : undefined
			});
		});
	});
}


State.prototype.close = function (cb) {
	if (this.timeout) {
		this.clearTimeout();
		this.timeout = null;
	}

	if (this.closing) {
		return;
	}

	this.closing = true;

	logger.verbose('Closing state:', this.getDescription());

	var fn;
	var that = this;

	if (this.errorCode) {
		fn = closeWithError;
	} else {
		fn = closeWithSuccess;
	}

	// do the rollback or commit

	fn.call(null, this, function (error, response) {
		// cleanup

		that.destroy();

		// return the response

		if (cb) {
			cb(null, response);
		}
	});
};


State.prototype.destroy = function () {
	if (!this.archivist) {
		logger.alert('Trying to destroy an already destroyed state object (' + this.getDescription() + ').');
	}

	this.archivist = null;
	this.errorCode = undefined;
	this.response = undefined;
	this.myEvents = [];
	this.otherEvents = undefined;
	this.session = undefined;

	exports.emit('destroyed');
};

