function MithrilGameModSns(mithril)
{
	this.mithril = mithril;
	this.relationcache = { relations: [], inbox: [], outbox: [] };
}

MithrilGameModSns.prototype.setup = function(cb)
{
	var _this = this;
	var cache = this.relationcache;

	this.mithril.io.on('sns.relationrequest.inbox.add', function(path, params) {
		cache.inbox.push(params);
	}, true);

	this.mithril.io.on('sns.relationrequest.outbox.add', function(path, params) {
		cache.outbox.push(params);
	}, true);

	this.mithril.io.on('sns.relationrequest.del', function(path, params) {
		cache.inbox = cache.inbox.filter(function(request) { return (request.id != params.id); });
		cache.outbox = cache.outbox.filter(function(request) { return (request.id != params.id); });
	}, true);

	this.mithril.io.on('sns.relation.add', function(path, params) {
		_this.relationcache.relations.push(params);
	}, true);

	this.mithril.io.on('sns.relation.del', function(path, params) {
		cache.relations = cache.relations.filter(function(relation) { return (relation.id != params.id); });
	}, true);

	this.mithril.io.send('sns.loadAll', {}, function(error, response) {
		_this.relationcache = response;
		console.log(response);
		cb();
	}, true);
};

MithrilGameModSns.prototype.requestRelation = function(type, actorId, cb) {
	this.mithril.io.send('sns.requestRelation', { type: type, actorId: actorId }, function(err, request) {
		if (err) { if (cb) cb(err); return; }

		if (cb) cb(null, request.id);
	});
};

MithrilGameModSns.prototype.delRelationRequest = function(requestId, cb) {
	this.mithril.io.send('sns.delRelationRequest', { requestId: requestId }, function(err,data) {
		if(err) { if(cb) { cb(err); } return; }
		if (cb) cb(null, data);
	});
};

MithrilGameModSns.prototype.delRelation = function(relationId, cb) {
	this.mithril.io.send('sns.delRelation', { relationId: relationId }, function(err,data) {
		if(err) { if(cb) { cb(err); } return; }
		if (cb) cb(null, data);
	});
};

