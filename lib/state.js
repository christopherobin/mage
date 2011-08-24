var mithril = require('./mithril'),
    DataSources = require('./datasources').DataSources;


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

	this.events = {};
	this.response = null;
	this.errorCode = null;
}


exports.State = State;


State.prototype.language = function () {
	return this.session ? this.session.language : 'JA';
};


State.prototype.emit = function (actorId, path, data) {
	var evt = [path, data];

	if (actorId in this.events) {
		this.events[actorId].push(evt);
	} else {
		this.events[actorId] = [evt];
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
	var msgClient = (this.session && this.session.msgClient) ? this.session.msgClient : null;

	for (var actorId in this.events) {
		var events = this.events[actorId];
		var i, len, evt;

		actorId = ~~actorId;

		if (actorId === this.actorId) {
			// events for the actor who triggered the events

			if (msgClient) {
				for (i = 0, len = events.length; i < len; i++) {
					evt = events[i];

					msgClient.emit(evt[0], evt[1]);
				}
			} else {
				// log the event?
				// in any case, we can drop the events.
			}
		} else {
			// events for other actors

			mithril.player.sessions.find(this, actorId, function (error, sess) {
				if (!error && sess && sess.msgClient) {
					for (i = 0, len = events.length; i < len; i++) {
						evt = events[i];
						sess.msgClient.emit(evt[0], evt[1]);
					}

					sess.msgClient.send();
				}
			});
		}
	}

	if (this.id) {
		if (msgClient) {
			msgClient.respond(this.id, this.response);
		} else {
			// log the response
		}
	}

	if (msgClient) {
		msgClient.send();
	}

	this.events = {};
	this.response = null;

	this.datasources.commit(cb);
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

