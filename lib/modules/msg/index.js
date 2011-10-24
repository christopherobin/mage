var mithril = require('../../mithril'),
    async = require('async');


exports.setup = function (state, cb) {
	// TODO: setup scheduled task to remove expired messages.

	cb();
};


exports.loadInbox = function (state, actorId, cb) {
	var time = mithril.core.time;

	var query = 'SELECT m.id, m.fromActorId, m.creationTime, m.expirationTime, m.type, c.title, c.body FROM msg AS m JOIN msg_content AS c ON c.msgId = m.id LEFT JOIN msg_to_actor AS ta ON ta.msgId = m.id WHERE c.language IN (?, ?) AND (ta.actorId = ? OR ta.actorId IS NULL) AND (m.expirationTime IS NULL OR m.expirationTime >= ?)';
	var params = [state.language(), '', actorId, time];

	state.datasources.db.getMapped(query, params, { key: 'id', keepKey: true }, null, function (error, messages) {
		if (error) {
			return cb(error);
		}

		var query = 'SELECT d.msgId, d.property, d.type, d.value FROM msg_data AS d JOIN msg AS m ON d.msgId = m.id LEFT JOIN msg_to_actor AS ta ON ta.msgId = m.id WHERE (ta.actorId = ? OR ta.actorId IS NULL) AND (m.expirationTime IS NULL OR m.expirationTime >= ?) AND d.language IN (?, ?)';
		var params = [actorId, time, '', state.language()];

		state.datasources.db.getMany(query, params, null, function (error, results) {
			if (error) {
				return cb(error);
			}

			for (var i = 0, len = results.length; i < len; i++) {
				var row = results[i];

				var msg = messages[row.msgId];

				if (msg) {
					msg.data = msg.data || {};

					msg.data[row.property] = mithril.core.PropertyMap.unserialize(row.type, row.value);
				}
			}

			var result = [];

			for (var id in messages) {
				result.push(messages[id]);
			}

			cb(null, result);
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
				return state.error(null, 'No content given for message ', callback);
			}

			var sql = 'INSERT INTO msg_content VALUES ';
			var params = [];
			var values = [];

			for (var i = 0, len = msg.content.length; i < len; i++)
			{
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

			if (!toActorIds || toActorIds.length === 0) {
				return callback();
			}

			var sql = 'INSERT INTO msg_to_actor VALUES ';
			var params = [];
			var values = [];

			for (var i = 0, len = toActorIds.length; i < len; i++)
			{
				params.push(msg.id, toActorIds[i]);
				values.push('(?, ?)');
			}

			sql += values.join(', ');

			state.datasources.db.exec(sql, params, null, function (error) {
				callback(error);
			});
		},
		function (callback)
		{
			// emit events

			// first get versions of this message in all its languages

			var msgVersions = getMessageVersions(msg);

			// if emitting to everybody, per language emit to all players with that language

			async.forEachSeries(
				msgVersions,
				function (msgVersion, vsCallback) {
					var filter = {};

					if (toActorIds && toActorIds.length > 0) {
						filter.actorIds = toActorIds;
					}

					if (msgVersion.language) {
						filter.language = msgVersion.language;
					}

					state.emitToMany(filter, 'msg.inbox.add', msgVersion.msg, vsCallback);
				},
				callback
			);
		}
	],
	function (error) {
		if (error) {
			return cb(error);
		}

		cb(null, msg);
	});
};

