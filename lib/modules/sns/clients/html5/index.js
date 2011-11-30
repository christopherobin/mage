(function () {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.sns.construct'));


	var cache = { relations: [], requests: [] };


	// class: relation

	function Relation(data) {
		this.id = data.id;
		this.type = data.type;
		this.actorIds = data.actorIds;
		this.creationTime = data.creationTime;
	}


	Relation.prototype.fromActorId = function () {
		return this.actorIds[0];
	};


	Relation.prototype.toActorId = function () {
		return this.actorIds[1];
	};


	Relation.prototype.bothActorIds = function () {
		return this.actorIds;
	};


	Relation.prototype.otherActorId = function (baseActorId) {
		if (this.actorIds[0] === (baseActorId >>> 0)) {
			return this.actorIds[1];
		}

		return this.actorIds[0];
	};


	// class: relation request

	function RelationRequest(data) {
		this.id = data.id;
		this.type = data.type;
		this.fromActorId = data.fromActorId;
		this.toActorId = data.toActorId;
		this.creationTime = data.creationTime;
	}


	// selection

	mod.getRelations = function (options) {
		var relations = cache.relations;

		if (!options) {
			return relations;
		}

		options = options || {};

		var result = [];

		for (var i = 0, len = relations.length; i < len; i++) {
			var relation = relations[i];

			if (options.type && relation.type !== options.type) {
				continue;
			}

			if (options.actorId && relation.actorIds.indexOf(options.actorId) === -1) {
				continue;
			}

			if (options.fromActorId && relation.actorIds[0] !== options.fromActorId) {
				continue;
			}

			if (options.toActorId && relation.actorIds[1] !== options.toActorId) {
				continue;
			}

			if (options.actorIds) {
				if (relation.actorIds.indexOf(options.actorIds[0]) === -1) {
					continue;
				}

				if (relation.actorIds.indexOf(options.actorIds[1]) === -1) {
					continue;
				}
			}

			result.push(relation);
		}

		return result;
	};


	mod.getRelationRequests = function (options) {
		var requests = cache.requests;

		if (!options) {
			return requests;
		}

		var result = [];

		for (var i = 0, len = requests.length; i < len; i++) {
			var request = requests[i];

			if (options.type && request.type !== options.type) {
				continue;
			}

			if (options.actorId && request.fromActorId !== options.actorId && request.toActorId !== options.actorId) {
				continue;
			}

			if (options.fromActorId && request.fromActorId !== options.fromActorId) {
				continue;
			}

			if (options.toActorId && request.toActorId !== options.toActorId) {
				continue;
			}

			if (options.actorIds) {
				if (request.fromActorId !== options.actorIds[0] && request.toActorId !== options.actorId[0]) {
					continue;
				}

				if (request.fromActorId !== options.actorIds[1] && request.toActorId !== options.actorId[1]) {
					continue;
				}
			}

			result.push(request);
		}

		return result;
	};


	// commands

	mod.setup = function (cb) {
		// setup event listeners

		mithril.io.on('sns.relationrequest.add', function (path, params) {
			cache.requests.push(new RelationRequest(params));
		}, true);


		mithril.io.on('sns.relationrequest.del', function (path, params) {
			cache.requests = cache.requests.filter(function (request) {
				return request.id !== params.id;
			});
		}, true);


		mithril.io.on('sns.relation.add', function (path, params) {
			cache.relations.push(new Relation(params));
		}, true);


		mithril.io.on('sns.relation.del', function (path, params) {
			cache.relations = cache.relations.filter(function (relation) {
				return relation.id !== params.id;
			});
		}, true);


		// load all sns data

		mod.sync(function (error, response) {
			if (error) {
				return cb(error);
			}

			var i, len;

			for (i = 0, len = response.relations.length; i < len; i++) {
				cache.relations.push(new Relation(response.relations[i]));
			}

			for (i = 0, len = response.requests.length; i < len; i++) {
				cache.requests.push(new RelationRequest(response.requests[i]));
			}

			cb();
		});
	};

}());
