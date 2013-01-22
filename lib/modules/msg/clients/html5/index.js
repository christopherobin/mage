(function (window) {

	var mage = window.mage;

	var mod = mage.registerModule($html5client('module.msg.construct'));


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


	function delFromInbox(id) {
		id = +id;

		inbox = inbox.filter(function (msg) {
			return msg.id !== id;
		});
	}


	mod.setup = function (cb) {
		mage.io.on('msg.inbox.add', function (path, data) {
			addToInbox(data);
		}, true);


		mage.io.on('msg.inbox.del', function (path, data) {
			delFromInbox(data.id);
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
