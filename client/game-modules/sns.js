function MithrilGameModPlayer(mithril)
{
	this.mithril = mithril;
	this.relationcache = { relations: {}, requests: {} };	
}

MithrilGameModPlayer.prototype.setup = function(cb)
{
	var _this = this;

	this.mithril.io.on('sns.relationrequest.add', function(path, params) {
		_this.relationcache.requests[params.id] = params;
	});
	
	this.mithril.io.on('sns.relationrequest.del', function(path, params) {
		delete _this.relationcache.requests[params.id];
	});
	
	this.mithril.io.on('sns.relation.add', function(path, params) {
		_this.relationcache.relations[params.id] = params;
	});
	
	this.mithril.io.on('sns.relation.del', function(path, params) {
		delete _this.relationcache.relations[params.id];
	});
	
	this.mithril.io.send('sns.loadAll', {}, function(error, response){
		this.relationcache = response; //err
	});
	
};

MithrilGameModPlayer.prototype.requestRelation = function(type, actorId, cb){
	var _this = this;
	
	this.mithril.io.send('sns.requestRelation', { type: type, actorId: actorId }, function(err,data){
		if(err) { if(cb) { cb(err); } return; }
		cb(null, data);
	});
};

MithrilGameModPlayer.prototype.deleteRelationRequest = function(requestId, cb){
	var _this = this;
	
	this.mithril.io.send('sns.deleteRelationRequest', { requestId: requestId }, function(err,data){
		if(err) { if(cb) { cb(err); } return; }
		cb(null, data);
	});
};

MithrilGameModPlayer.prototype.deleteRelationRequest = function(relationId, cb){
	var _this = this;
	
	this.mithril.io.send('sns.deleteRelation', { relationId: relationId }, function(err,data){
		if(err) { if(cb) { cb(err); } return; }
		cb(null, data);
	});
};


