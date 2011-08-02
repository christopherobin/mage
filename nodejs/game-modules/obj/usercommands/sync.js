var mithril = require('../../../mithril.js'),
    async = require('async');


exports.execute = function(state, p, cb)
{
	mithril.obj.getActorCollections(state, state.actorId, ['collectionId', 'parentId', 'collectionType', 'slotCount', 'maxWeight'], function(error, collections) {	// get player collections
		if (error) return cb();

		var objectData = { collections: {} };

		async.forEachSeries(
			collections,
			function(coll, callback) {

				// trim down optional data for transport

				if (!coll.parentId) delete coll.parentId;
				if (!coll.slotCount) delete coll.slotCount;
				if (!coll.maxWeight) delete coll.maxWeight;

				coll.members = [];
				coll.owner = state.actorId;

				objectData.collections[coll.collectionId] = coll;

				mithril.obj.getCollectionMembers(state, coll.collectionId, function(err, members) {
					if (err) return callback(err);

					var len = members.length;
					for (var i=0; i < len; i++)
					{
						if (members[i].slot)
							coll.members.push({ id: members[i].object, slot: members[i].slot });
						else
							coll.members.push({ id: members[i].object });
					}

					callback();
				});
			},
			function(error) {
				if (error) return cb(error);

				mithril.obj.getActorObjects(state, state.actorId, function(error, objects) {  // get player objects
					if (error) return cb(error);

					objectData.objects = objects;

					var objectMap = {};

					var len = objects.length;
					for (var i=0; i < len; i++)
					{
						var o = objects[i];

						// trim down optional data for transport

						if (!o.appliedToObject) delete o.appliedToObject;
						if (!o.weight) delete o.weight;

						objectMap[o.id] = o;
					}

					mithril.obj.getObjectDataByOwner(state, state.actorId, function(err, data) {  // get object dataMulti
						if (err) return cb(error);

						var len = data.length;
						for (var i=0; i < len; i++)
						{
							var prop = data[i];
							var o = objectMap[prop.object];

							if (!o) continue;
							if (!o.data) o.data = {};

							o.data[prop.property] = prop.value;
						}

						state.respond({
							classData: mithril.obj.getAllClasses(state.language(), ['none', 'inherit'], true),
							objectData: objectData
						});

						cb();
					});
				});
			}
		);
	});
};

