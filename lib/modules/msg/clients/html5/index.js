(function (window) {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.msg.construct'));


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


	mod.setup = function (cb) {
		mithril.io.on('msg.inbox.add', function (path, data) {
			addToInbox(data);
		}, true);


		mod.sync(function (error, result) {
			if (error) {
				return cb(error);
			}

			resetInbox(result.inbox);

			cb();
		});
	};


	mod.search = function (options) {
		// options: { type: 'type', from: [actorId, actorId, ...] }
		// default, and currently only mailbox is 'inbox'

		options = options || {};

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

}(window));
