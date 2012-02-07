var mithril = require('./mithril'),
    logger = mithril.core.logger,
    DataSources = require('./datasources').DataSources,
    async = require('async');


// magic caching constant

var commandResponseTTL = 3 * 60;


function State(actorId, session) {
	// behaves like a transaction, and will send off everything that happened after commit() is called.

	this.actorId = actorId ? (actorId >>> 0) : null;
	this.session = session || null;

	this.data = {};		// may be used to pass data around between functions

	this.datasources = new DataSources(this);
	this.datasources.autoTransaction({ write: true, read: false });

	// information for command response output:

	this.myEvents = [];		// events for this session
	this.sysErrorCode = null;
	this.userErrorCode = null;
	this.response = null;

	this.otherEvents = null;	// events for other actors: { actorId: [ list of events ], actorId: etc... }
}


exports.State = State;


State.prototype.registerSession = function (session) {
	this.session = session;
	this.actorId = session.actorId;
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

	// pull addresses and languages from membase and mysql (so can be in parallel)
	// TODO: if none of our events are language tagged, we should not be reading language information from disk

	var state = this;

	async.parallel({
		addresses: function (callback) {
			mithril.session.getActorAddresses(state, actorIds, callback);
		},
		languages: function (callback) {
			mithril.player.getLanguages(state, actorIds, callback);
		}
	},
	function (error, result) {
		if (error) {
			return cb(error);
		}

		var languages = result.languages, addresses = result.addresses;

		var comm = mithril.core.msgServer.comm;

		for (var i = 0, len = addresses.length; i < len; i++) {
			var address = addresses[i];
			var actorId = address.actorId;
			var entries = events[actorId] || [];
			var language = languages[actorId];
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


State.prototype.language = function () {
	return this.session ? this.session.language : 'JA';
};


State.prototype.emit = function (actorId, path, data, language, isJson) {
	// language may be omitted
	// if language is provided, it will only emit if the language matches the language used by actorId

	if (!isJson) {
		data = JSON.stringify(data);
	}

	var evt = '["' + path + '",' + data + ']';

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

		if (done.indexOf(actorId) === -1) {
			this.emit(actorId, path, data, language, true);
			done.push(actorId);
		}
	}
};


State.prototype.error = function (code, logDetails, cb) {
	if (logDetails) {
		if (this.actorId) {
			logger.error('Actor' + this.actorId, logDetails);
		} else {
			logger.error(logDetails);
		}
	}

	if (!code) {
		code = 'server';
	}

	this.sysErrorCode = code;

	if (cb) {
		cb(code);
	}
};


State.prototype.userError = function (code, cb) {
	// For errors that are caused by users. We don't need to log them to the error log, but we want a meaningful error message for the user.

	logger.debug('User error: ' + code);

	this.userErrorCode = code;

	if (cb) {
		cb(code);
	}
};


State.prototype.respond = function (response) {
	this.response = JSON.stringify(response);
};


State.prototype.respondJson = function (response) {
	this.response = response;
};


State.prototype.close = function (cb) {
	var fn;
	var response = {};
	var that = this;


	// response format:
	//   [error] or:          // core error ('auth', 'server', ...) (state.error)
	//   [null, error] or:    // error as a response alternative (state.userError)
	//   [null, null, response obj, events array]	// where events may be left out

	if (this.sysErrorCode) {
		// rollback

		fn = this.datasources.rollBack;

		response.sysErrorCode = this.sysErrorCode;

		// cancel events to other players

		this.otherEvents = null;
	} else if (this.userErrorCode) {
		// rollback

		fn = this.datasources.rollBack;

		response.userErrorCode = this.userErrorCode;

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

		that.emitEvents(function (error) {
			// cleanup

			that.destroy();

			// return the response

			if (cb) {
				cb(null, response);
			}
		});
	});
};


State.prototype.destroy = function () {
	this.datasources.close();	// close connections

	this.datasources = null;
	this.myEvents = null;
	this.otherEvents = null;
	this.response = null;
	this.session = null;
};

