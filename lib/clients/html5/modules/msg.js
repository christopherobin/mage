(function () {

	var mithril = window.mithril;

	var mod = {};

	mithril.registerModule('msg', mod);


	var inbox = [];	// sorted: most recent > oldest


	function resetInbox(messages) {
		messages.sort(function (a, b) {
			return b.creationTime - a.creationTime;
		});

		inbox = messages;
	}


	function addToInbox(msg) {
		inbox.unshift(msg);
	}


	mod.sync = function (cb) {
		mithril.io.send('msg.sync', {}, null, function (errors, result) {
			if (errors) {
				return cb(errors);
			}

			resetInbox(result.inbox);

			cb();
		});
	};


	mod.setup = function (cb) {
		mithril.io.on('msg.inbox.add', function (path, data) {
			addToInbox(data);
		}, true);

		mod.sync(cb);
	};


	mod.search = function (options) {
		// options: { mailbox: 'inbox', type: 'type', from: [actorId, actorId, ...] }
		// default, and currently only mailbox is 'inbox'

		return inbox.filter(function (msg) {
			if (options.type && msg.type !== options.type) {
				return false;
			}

			if (options.from && options.from.indexOf(msg.fromActorId) === -1) {
				return false;
			}

			return true;
		});
	};

}());
