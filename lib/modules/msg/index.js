var mithril = require('../../mithril'),
    async = require('async');


exports.setup = function (state, cb) {
	cb();
};


function getReceivers(state, msgIds, cb) {
	// yields { msgId: [actorId, actorId], msgId: [actorId] } for the given message IDs

	var db = state.datasources.db;

	var sql = 'SELECT msgId, actorId FROM msg_to_actor WHERE actorId IS NOT NULL AND msgId IN (' + db.getPlaceHolders(msgIds.length) + ')';
	var params = msgIds;

	db.getMany(sql, params, null, function (error, rows) {
		if (error) {
			return cb(error);
		}

		var result = {};

		for (var i = 0, len = rows.length; i < len; i++) {
			var row = rows[i];

			if (!row.actorId) {
				continue;
			}

			if (result[row.msgId]) {
				result[row.msgId].push(row.actorId);
			} else {
				result[row.msgId] = [row.actorId];
			}
		}

		cb(null, result);
	});
}


function deleteMessages(state, ids, cb) {
	var len = ids.length;

	if (len === 0) {
		return cb();
	}

	var db = state.datasources.db;

	var sql = 'DELETE FROM msg WHERE id IN (' + db.getPlaceHolders(len) + ')';
	var params = ids;

	db.exec(sql, params, null, cb);
}


exports.loadInbox = function (state, actorId, cb) {
	var db = state.datasources.db;

	var query = 'SELECT m.id, m.fromActorId, m.creationTime, m.expirationTime, m.type, c.title, c.body FROM msg_to_actor AS ta JOIN msg AS m ON ta.msgId = m.id LEFT JOIN msg_content AS c ON c.msgId = m.id WHERE c.language IN (?, ?) AND (ta.actorId = ? OR ta.actorId IS NULL)';
	var params = [state.language(), '', actorId];

	db.getMapped(query, params, { key: 'id', keepKey: true }, null, function (error, messages) {
		if (error) {
			return cb(error);
		}

		var time = mithril.core.time;
		var expireIds = [];   // messages (IDs) to delete from the database
		var resultIds = [];   // IDs of messages that should be yielded to the callback
		var result = [];      // messages to yield to the callback

		for (var msgId in messages) {
			var msg = messages[msgId];

			if (msg.expirationTime && msg.expirationTime < time) {
				expireIds.push(msg.id);
			} else {
				resultIds.push(msg.id);
				result.push(msg);
			}
		}

		// if there is nothing to yield

		if (resultIds.length === 0) {
			// we still need to expire old messages

			deleteMessages(state, expireIds, function (error) {
				if (error) {
					return cb(error);
				}

				cb(null, []);
			});
			return;
		}

		var query = 'SELECT msgId, property, type, value FROM msg_data WHERE msgId IN (' + db.getPlaceHolders(resultIds.length) + ') AND language IN (?, ?)';
		var params = resultIds.concat('', state.language());

		db.getMany(query, params, null, function (error, rows) {
			if (error) {
				return cb(error);
			}

			for (var i = 0, len = rows.length; i < len; i++) {
				var row = rows[i];

				var msg = messages[row.msgId];

				if (msg) {
					msg.data = msg.data || {};

					msg.data[row.property] = mithril.core.PropertyMap.unserialize(row.type, row.value);
				}
			}

			// expire old messages

			deleteMessages(state, expireIds, function (error) {
				if (error) {
					return cb(error);
				}

				// yield the result

				cb(null, result);
			});
		});
	});
};


function getMessageVersions(msg) {
	// make a list of all used languages

	var languages = [];

	var contentLen = msg.content.length;

	for (var i = 0; i < contentLen; i++) {
		var content = msg.content[i];

		if (content.language && languages.indexOf(content.language) === -1) {
			languages.push(content.language);
		}
	}

	for (var property in msg.data) {
		var item = msg.data[property];

		if (item.language && languages.indexOf(item.language) === -1) {
			languages.push(item.language);
		}
	}

	if (languages.length === 0) {
		// message without a specific language

		return [{ msg: msg }];
	}

	// make a message per found language

	var result = [];

	languages.forEach(function (language) {
		var newMsg = {
			id: msg.id,
			fromActorId: msg.fromActorId,
			creationTime: msg.creationTime,
			expirationTime: msg.expirationTime,
			type: msg.type,
			data: {}
		};

		// add content

		for (var i = 0; i < contentLen; i++) {
			var content = msg.content[i];

			if (!content.language || content.language === language) {
				newMsg.title = content.title || '';
				newMsg.body = content.body || '';
				break;
			}
		}

		// add data

		for (var property in msg.data) {
			var prop = msg.data[property];
			var len = prop.length;

			for (i = 0; i < len; i++) {
				var item = prop[i];

				if (!item.language || item.language === language) {
					newMsg.data[property] = item.value;
					break;
				}
			}
		}

		result.push({ language: language, msg: newMsg });
	});

	return result;
}


exports.send = function (state, fromActorId, toActorIds, expirationTime, type, content, data, cb) {
	// sends a message or notification
	//
	// fromActorId:		optional sender.
	// toActorIds:		optional array of actor IDs to which the message is being sent. May be empty or left out, in the case of announcements for example. In that case the event will be emitted to every player in the system.
	// expirationTime:	optional unix timestamp of when the message should auto-delete.
	// type:			optional string that characterizes the type of message this is. eg: "announcement", "mail", "news", "friendrequest". Any value is allowed.
	// content:			object of structure: [{ language: langCode, title: string, body: string }, ...], where title and langCode are optional. Every language code given must be unique.
	// data:			optional property/value storage of structure: { propertyName: [{ language: langCode, value: value }], propertyName: [{ value: value }] }.

	var msg = {
		fromActorId: fromActorId || null,
		creationTime: mithril.core.time,
		expirationTime: expirationTime || null,
		type: type || '',
		content: content,
		data: data || {}
	};

	async.series([
		function (callback) {
			var sql = 'INSERT INTO msg VALUES (NULL, ?, ?, ?, ?)';
			var params = [msg.fromActorId, msg.creationTime, msg.expirationTime, msg.type];

			state.datasources.db.exec(sql, params, null, function (error, info) {
				if (error) {
					return callback(error);
				}

				msg.id = info.insertId;

				callback();
			});
		},
		function (callback) {
			// insert the message title/body

			if (!msg.content) {
				return callback();
			}

			var sql = 'INSERT INTO msg_content VALUES ';
			var params = [];
			var values = [];

			for (var i = 0, len = msg.content.length; i < len; i++) {
				var item = msg.content[i];

				values.push('(?, ?, ?, ?)');
				params.push(msg.id, item.language || '', item.title || '', item.body);
			}

			sql += values.join(', ');

			state.datasources.db.exec(sql, params, null, function (error) {
				callback(error);
			});
		},
		function (callback) {
			// insert the message data (property/value)

			var sql = 'INSERT INTO msg_data VALUES ';
			var params = [];
			var values = [];

			for (var property in msg.data) {
				var prop = msg.data[property];

				for (var i = 0, len = prop.length; i < len; i++) {
					var item = prop[i];

					var packed = mithril.core.PropertyMap.serialize(item.value);

					values.push('(?, ?, ?, ?, ?)');
					params.push(msg.id, property, item.language || '', packed.type, packed.value);
				}
			}

			if (params.length > 0) {
				sql += values.join(', ');

				state.datasources.db.exec(sql, params, null, function (error) {
					callback(error);
				});
			} else {
				callback();
			}
		},
		function (callback) {
			// link up message receivers

			var sql = 'INSERT INTO msg_to_actor VALUES ';
			var params = [];
			var values = [];

			if (!toActorIds || toActorIds.length === 0) {
				params.push(msg.id);
				values.push('(NULL, ?, NULL)');
			} else {
				for (var i = 0, len = toActorIds.length; i < len; i++) {
					params.push(msg.id, toActorIds[i]);
					values.push('(NULL, ?, ?)');
				}
			}

			sql += values.join(', ');

			state.datasources.db.exec(sql, params, null, function (error) {
				callback(error);
			});
		},
		function (callback) {
			// emit events

			if (!toActorIds || toActorIds.length === 0) {
				return callback();
			}

			// first get versions of this message in all its languages

			var msgVersions = getMessageVersions(msg);

			for (var i = 0, len = msgVersions.length; i < len; i++) {
				var msgVersion = msgVersions[i];

				state.emitToActors(toActorIds, 'msg.inbox.add', msgVersion.msg, msgVersion.language);
			}

			callback();
		}
	],
	function (error) {
		if (error) {
			return cb(error);
		}

		cb(null, msg);
	});
};


exports.delMessages = function (state, ids, options, cb) {
	// NOTE: this function relies on foreign key cascading deletes

	if (!Array.isArray(ids)) {
		return state.error(null, 'msg.delMessages received a non-array ids argument.', cb);
	}

	if (ids.length === 0) {
		return cb();
	}

	options = options || {};

	getReceivers(state, ids, function (error, receivers) {
		if (error) {
			return cb(error);
		}

		if (!options.ignoreOwner) {
			var actorId = state.actorId;

			for (var msgId in receivers) {
				var actors = receivers[msgId];

				// msg may only be deleted if the actor is the only receiver

				if (actors.length !== 1 || actors[0] !== actorId) {
					// remove the msg from the deletion list

					return state.error(null, 'Actor tried to delete non-owned messages.', cb);
				}
			}
		}

		deleteMessages(state, ids, function (error) {
			if (error) {
				return cb(error);
			}

			for (var i = 0, len = ids.length; i < len; i++) {
				var msgId = ids[i];
				var actorIds = receivers[msgId];

				if (actorIds) {
					state.emitToActors(actorIds, 'msg.inbox.del', { id: msgId });
				}
			}

			cb();
		});
	});
};

