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

	this.otherEvents = [];	// events for other actors: [{ actorId: [], events: [] }]
}


exports.State = State;


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
	console.log('Command response:', response);

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

	console.log('closing state object', this.errorCode, this.response, this.myEvents);

	if (this.errorCode) {
		// rollback

		fn = this.datasources.rollBack;

		response.push(this.errorCode);

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
		console.log(response, options);

		if (cb) {
			cb(response, options);
		}

		that.destroy();
	});
};


State.prototype.destroy = function () {
	this.datasources.close();

	delete this.datasources;
	delete this.myEvents;
	delete this.response;
	delete this.session;
};

