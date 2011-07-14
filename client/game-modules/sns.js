function MithrilGameModSns(mithril)
{
	this.mithril = mithril;
	this.relationcache = { relations: [], inbox: [], outbox: [] };
}

MithrilGameModSns.prototype.setup = function(cb)
{
	var _this = this;

	// setup event listeners

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
		cache.relations.push(params);
	}, true);

	this.mithril.io.on('sns.relation.del', function(path, params) {
		cache.relations = cache.relations.filter(function(relation) { return (relation.id != params.id); });
	}, true);


	// load all sns data

	this.mithril.io.send('sns.sync', {}, function(errors, response) {
		if (errors) return cb(errors);

		cache = _this.relationcache = response;

		cb();
	}, true);
};


MithrilGameModSns.prototype.getRelations = function(type)
{
	return this.relationcache.relations.filter(function(relation) { return relation.type == type; });
};


MithrilGameModSns.prototype.getRelationRequestsFrom = function(type)
{
	return this.relationcache.outbox.filter(function(relation) { return relation.type == type; });
};


MithrilGameModSns.prototype.getRelationRequestsTo = function(type)
{
	return this.relationcache.inbox.filter(function(relation) { return relation.type == type; });
};


MithrilGameModSns.prototype.requestRelation = function(type, actorId, cb) {
	this.mithril.io.send('sns.requestRelation', { type: type, actorId: actorId }, cb);
};


MithrilGameModSns.prototype.delRelationRequest = function(requestId, cb) {
	this.mithril.io.send('sns.delRelationRequest', { requestId: requestId }, function(err,data) {
		if (err) { if (cb) { cb(err); } return; }
		if (cb) cb(null, data);
	});
};


MithrilGameModSns.prototype.delRelation = function(relationId, cb) {
	this.mithril.io.send('sns.delRelation', { relationId: relationId }, function(err,data) {
		if(err) { if(cb) { cb(err); } return; }
		if (cb) cb(null, data);
	});
};

