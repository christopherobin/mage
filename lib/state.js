var mithril = require('./mithril'),
    DataSources = require('./datasources').DataSources,
    async = require('async'),
    msgpack = require('msgpack-0.4');


function State(actorId, session) {
	// behaves like a transaction, and will send off everything that happened after commit() is called.

	this.actorId = actorId ? (actorId >>> 0) : null;
	this.session = session || null;

	this.data = {};		// may be used to pass data around between functions

	this.datasources = new DataSources(this);
	this.datasources.autoTransaction({ write: true, read: false });

	// information for command response output:

	this.myEvents = [];		// events for this session
	this.callbackId = null;
	this.errorCode = null;
	this.response = null;
	this.options = {};
	this.onclose = null;

	this.otherEvents = null;	// events for other actors: { actorId: [ list of events ], actorId: etc... }
}


exports.State = State;


State.prototype.emitEvents = function (cb) {
	if (!this.otherEvents) {
		return cb();
	}

	var events = this.otherEvents;

	this.otherEvents = null;

	var actorIds = [];

	for (var actorId in events) {
		actorIds.push(actorId);
	}

	mithril.session.getActorAddresses(this, actorIds, function (error, addresses) {
		if (error) {
			return cb(error);
		}

		console.log('Session addresses', addresses);

		for (var i = 0, len = addresses.length; i < len; i++) {
			var address = addresses[i];
			var actorEvents = events[actorId];

			if (actorEvents && actorEvents.length > 0) {
				mithril.core.msgServer.comm.send(address.addrName, address.host, actorEvents);
			}
		}

		cb();
	});
};


State.prototype.serializeResponse = function () {
	var buff;

	try {
		buff = msgpack.pack({
			errorCode: this.errorCode,
			response: this.response,
			myEvents: this.myEvents,
			options: this.options
		});
	} catch (e) {
		mithril.core.logger.error('Msgpack failed to pack:', e);
		return null;
	}
};


State.prototype.unserializeResponse = function (buff) {
	var data = msgpack.unpack(buff);

	this.errorCode = data.errorCode || null;
	this.response = data.response || null;
	this.myEvents = data.myEvents || [];
	this.options = data.options || {};
};


State.prototype.language = function () {
	return this.session ? this.session.language : 'JA';
};


State.prototype.emit = function (actorId, path, data) {
	var evt = [path, data];

	actorId = actorId >>> 0;

	if (actorId === this.actorId) {
		// events for this.actorId

		this.myEvents.push(evt);
	} else {
		// events for other actors

		if (!this.otherEvents) {
			this.otherEvents = {};
			this.otherEvents[actorId] = [evt];
		} else {
			var forActor = this.otherEvents[actorId];
			if (forActor) {
				forActor.push(evt);
			} else {
				this.otherEvents[actorId] = [evt];
			}
		}
	}
};


State.prototype.emitToActors = function (actorIds, path, data) {
	// remove duplicate actorIds

	// TODO: pre-sorting the actorIds and then comparing current id to previous might be a faster way to avoid duplicates

	var done = [];

	for (var i = 0, len = actorIds.length; i < len; i++) {
		var actorId = (actorIds[i] >>> 0);

		if (done.indexOf(actorId) === -1) {
			this.emit(actorId, path, data);
			done.push(actorId);
		}
	}
};


State.prototype.emitToMany = function (filter, path, data, cb) {
	var query = 'SELECT actor FROM player';
	var params = [];
	var where = [];

	var db = this.datasources.db;

	if (filter.actorIds) {
		where.push('actor IN (' + db.getPlaceHolders(filter.actorIds.length) + ')');
		params = params.concat(filter.actorIds);
	}

	if (filter.language) {
		where.push('language = ?');
		params.push(filter.language);
	}

	if (where.length > 0) {
		query += ' WHERE ' + where.join(' AND ');
	}

	var _this = this;

	db.getMany(query, params, null, function (error, players) {
		if (error) {
			return cb(error);
		}

		for (var i = 0, len = players.length; i < len; i++) {
			_this.emit(players[i].actor, path, data);
		}

		cb();
	});
};


State.prototype.error = function (userCode, logDetails, cb) {
	if (logDetails) {
		mithril.core.logger.error(logDetails);
	}

	if (!userCode) {
		userCode = 'server';
	}

	this.errorCode = userCode;

	if (cb) {
		cb(userCode);
	}
};


State.prototype.userError = function (userCode, cb) {
	// For errors that are caused by users. We don't need to log them per se, but we want a meaningful error message for the user.

	this.errorCode = userCode;

	if (cb) {
		cb(userCode);
	}
};


State.prototype.respond = function (response) {
	this.response = response;
};


State.prototype.close = function () {
	var cb = this.onclose;
	this.onclose = null;
	var fn;
	var that = this;

	// response format:
	//   [error] or:
	//   [null, response obj, events array]	// where events may be left out

	var response = [];
	var options = this.options;

	if (this.errorCode) {
		// rollback

		fn = this.datasources.rollBack;

		response.push(this.errorCode);

		// cancel events to other players

		this.otherEvents = null;
	} else {
		// commit

		fn = this.datasources.commit;

		response.push(null, this.response);

		if (this.myEvents.length > 0) {
			response.push(this.myEvents);
		}
	}

	// do the rollback or commit, and respond

	fn.call(this.datasources, function () {
		if (cb) {
			cb(response, options);
		}

		// emit events to other players

		that.emitEvents(function () {
			// cleanup

			that.destroy();
		});
	});
};


State.prototype.destroy = function () {
	this.datasources.close();

	delete this.datasources;
	delete this.myEvents;
	delete this.otherEvents;
	delete this.response;
	delete this.session;
};

