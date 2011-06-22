function MithrilGameModMsg(mithril)
{
	this.mithril = mithril;
	this.inbox = [];	// sorted: most recent > oldest
}


MithrilGameModMsg.prototype.setup = function(cb)
{
	var _this = this;

	this.mithril.io.on('msg.inbox.add', function(path, data) { _this.onInboxAdd(path, data); }, true);

	this.mithril.io.send('msg.sync', {}, function(errors, result) {
		if (errors) return cb(errors);

		_this.resetInbox(result.inbox);
		cb();
	});
};


MithrilGameModMsg.prototype.resetInbox = function(messages)
{
	messages.sort(function(a, b) { return b.creationTime - a.creationTime; });

	this.inbox = messages;
};


MithrilGameModMsg.prototype.search = function(options)
{
	// options: { mailbox: 'inbox', type: 'type', from: [actorId, actorId, ...] }
	// default, and currently only mailbox is 'inbox'

	return this.inbox.filter(function(msg) {
		if (options.type && msg.type != options.type) return false;
		if (options.from && options.from.indexOf(msg.fromActorId) == -1) return false;
		return true;
	});
};


MithrilGameModMsg.prototype.onInboxAdd = function(path, msg)
{
	this.inbox.unshift(msg);
};

