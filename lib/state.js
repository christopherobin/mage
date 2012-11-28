var mithril = require('./mithril'),
    logger = mithril.core.logger,
    DataSources = require('./datasources').DataSources,
    EventEmitter = require('events').EventEmitter;

var NO_DESCRIPTION = 'no description';

exports = module.exports = new EventEmitter();

function State(actorId, session) {
	// behaves like a transaction, and will send off everything that happened after commit() is called.

	this.actorId = actorId ? (actorId >>> 0) : null;
	this.session = session || null;

	this.data = {};		// may be used to pass data around between functions
	this.description = null;

	this.datasources = new DataSources(this);
	this.datasources.autoTransaction({ write: true, read: false });

	// information for command response output:

	this.errorCode = null;
	this.response = null;
	this.myEvents = [];		// events for this session

	this.otherEvents = null;	// events for other actors: { actorId: [ list of events ], actorId: etc... }

	this.timeout = null;	// timeout
	exports.emit('stateCreated');
}


exports.State = State;


State.prototype.setTimeout = function (timeout) {
	this.clearTimeout();

	var that = this;

	this.timeout = setTimeout(function () {
		that.error(null, 'State timed out: ' + that.getDescription(), function () {
			that.close();
		});

		exports.emit('stateTimeOut', timeout);
	}, timeout);
};


State.prototype.clearTimeout = function () {
	clearTimeout(this.timeout);
	this.timeout = null;
};


State.prototype.registerSession = function (session) {
	this.session = session;
	this.actorId = session.actorId;
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

	this.otherEvents = null;

	var actorIds = [];

	for (var actorId in events) {
		actorIds.push(actorId >>> 0);
	}

	if (actorIds.length === 0) {
		return cb();
	}

	// pull addresses out of the session module

	if (!mithril.session) {
		return cb();
	}

	mithril.session.getActorAddresses(this, actorIds, function (error, addresses) {
		if (error) {
			return cb(error);
		}

		// send events per address/actor

		var comm = mithril.core.msgServer.comm;

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

			comm.send(address.addrName, address.host, '[' + actorEvents.join(',') + ']');
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
		// it is possible (and valid) that emit() was called for an undefined state.actorId
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

	actorId = actorId >>> 0;

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
	if (!actorIds || actorIds.length === 0) {
		return;
	}

	// remove duplicate actorIds

	// TODO: pre-sorting the actorIds and then comparing current id to previous might be a faster way to avoid duplicates

	var done = [];

	if (!isJson) {
		data = JSON.stringify(data);
	}

	for (var i = 0, len = actorIds.length; i < len; i++) {
		var actorId = (actorIds[i] >>> 0);

		if (!actorId) {
			continue;
		}

		if (done.indexOf(actorId) === -1) {
			this.emit(actorId, path, data, language, true);
			done.push(actorId);
		}
	}
};


State.prototype.error = function (code, logDetails, cb) {
	exports.emit('error');

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


State.prototype.userError = function (code, cb) {
	logger.warning('state.userError() is deprecated. From now on, please use state.error(code, null, cb) if you do not want to send anything to the error log.');

	this.error(code, null, cb);
};


State.prototype.respond = function (response) {
	this.response = JSON.stringify(response);
};


State.prototype.respondJson = function (response) {
	this.response = response;
};


State.prototype.close = function (cb) {
	if (this.timeout) {
		this.clearTimeout();
	}

	if (this.closing) {
		return;
	}

	this.closing = true;

	logger.verbose('Closing state:', this.getDescription());

	var fn;
	var response = {};
	var that = this;


	// response format:
	//   [error] or:          // core error ('auth', 'server', ...) (state.error)
	//   [null, error] or:    // error as a response alternative (state.userError)
	//   [null, null, response obj, events array]	// where events may be left out

	if (this.errorCode) {
		// rollback

		fn = this.datasources.rollBack;

		response.errorCode = this.errorCode;

		// cancel events to other players

		this.otherEvents = null;
	} else {
		// commit

		fn = this.datasources.commit;

		if (this.response) {
			response.response = this.response;
		}

		if (this.myEvents.length > 0) {
			response.myEvents = this.myEvents;
		}
	}

	// do the rollback or commit

	fn.call(this.datasources, function () {
		// emit events to other players

		that.emitEvents(function () {
			// cleanup

			that.destroy();
			exports.emit('stateDestroyed');

			// return the response

			if (cb) {
				cb(null, response);
			}
		});
	});
};


State.prototype.destroy = function () {
	if (this.datasources) {
		this.datasources.close();	// close connections
	} else {
		logger.error('Trying to destroy an already destroyed state object (' + this.getDescription() + ').');
	}

	this.datasources = null;
	this.errorCode = null;
	this.response = null;
	this.myEvents = null;
	this.otherEvents = null;
	this.session = null;
};

