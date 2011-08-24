var mithril = require('./mithril'),
    DataSources = require('./datasources').DataSources,
	async = require('async');


function State(actorId, msg, session) {
	// behaves like a transaction, and will send off everything that happened after commit() is called.

	this.actorId = actorId ? ~~actorId : null;

	if (!msg) {
		msg = {};
	}

	this.cmd = msg.cmd || null;
	this.p   = msg.p   || {};
	this.id  = msg.id  || null;
	this.data = {};		// may be used to pass data around between functions

	this.session = session || null;

	this.datasources = new DataSources(this);
	this.datasources.autoTransaction({ write: true, read: false });

	this.myEvents = [];		// events for this.actorId
	this.otherEvents = [];	// events for other actors: [{ actorId: [], events: [] }}
	this.response = null;
	this.errorCode = null;
}


exports.State = State;


State.prototype.language = function () {
	return this.session ? this.session.language : 'JA';
};


State.prototype.emit = function (actorId, path, data) {
	var evt = [path, data];

	actorId = ~~actorId;

	if (actorId === this.actorId) {
		// events for this.actorId

		this.myEvents.push(evt);
	} else {
		// events for other actors

		var pushed = false;

		for (var i = 0, len = this.otherEvents.length; i < len; i++) {
			var entry = this.otherEvents[i];

			if (entry.actorId === actorId) {
				entry.events.push(evt);
				pushed = true;
				break;
			}
		}

		if (!pushed) {
			this.otherEvents.push({ actorId: actorId, events: [evt] });
		}
	}
};


State.prototype.emitToActors = function (actorIds, path, data) {
	// remove duplicate actorIds

	var done = [];

	for (var i = 0, len = actorIds.length; i < len; i++) {
		var actorId = actorIds[i];

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
	var _this = this;

	if (this.errorCode) {
		this.rollBack(function () {
			_this._cleanup();
		});
	} else {
		this.commit(function () {
			_this._cleanup();
		});
	}
};


State.prototype.commit = function (cb) {
	var msgClient = this.session ? this.session.msgClient : null;
	var i, len, evt;

	// send events, response to state.actorId

	if (msgClient) {
		for (i = 0, len = this.myEvents.length; i < len; i++) {
			evt = this.myEvents[i];

			msgClient.emit(evt[0], evt[1]);
		}

		if (this.id) {
			msgClient.respond(this.id, this.response);
		}

		msgClient.send();
	}

	this.myEvents = [];
	this.response = null;

	// send events to other actors (in parallel)

	if (this.otherEvents.length > 0) {
		var _this = this;

		this.datasources.commit(function () {
			var sessions = mithril.player.sessions;

			async.forEachSeries(
				_this.otherEvents,
				function (entry, callback) {
					sessions.find(_this, entry.actorId, function (error, sess) {
						if (!error && sess && sess.msgClient) {
							for (var j = 0, jlen = entry.events.length; j < jlen; j++) {
								evt = entry.events[j];
								sess.msgClient.emit(evt[0], evt[1]);
							}

							sess.msgClient.send();
						}
					});
				},
				function (error) {
					_this.otherEvents = [];
					cb();
				}
			);
		});
	} else {
		this.datasources.commit(cb);
	}
};


State.prototype.rollBack = function (cb) {
	if (this.id) {
		var msgClient = this.session ? this.session.msgClient : null;

		if (msgClient) {
			msgClient.respond(this.id, null, this.errorCode);
			msgClient.send();
		} else {
			// log the response
		}
	}

	this.events = {};
	this.response = null;
	this.errorCode = null;

	this.datasources.rollBack(cb);
};


State.prototype._cleanup = function () {
	this.datasources.close();

	this.datasources = null;
	this.session = null;
	this.p = null;
};

