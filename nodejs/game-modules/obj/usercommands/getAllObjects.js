exports.execute = function(state, p, cb)
{
	var returnData = {};
	var collections = null;
	var objects = null;
	var objectProperties = null;
	var collectionMembers = null;


	mithril.obj.getActorCollections(state, state.actorId, ['collectionId', 'parentId', 'collectionType', 'slotCount', 'maxWeight'], {}, function(error, data) {	// get player collections
		if (error) return cb();

		returnData.collections = {};

		async.forEachSeries(
			data,
			function(coll, callback) {
				coll.members = [];
				coll.owner = state.actorId;

				returnData.collections[coll.collectionId] = coll;

				mithril.obj.getCollectionMembers(state, coll.collectionId, function(err, cMdata) {
					if (err) { callback(err); return; }

					for (var l=0; l < cMdata.length; l++)
					{
						coll.members.push({ id: cMdata[l].object, slot: cMdata[l].slot });
					}

					callback();
				});
			},
			function(error) {
				if (error) return cb(error);

				mithril.obj.getActorObjects(state, state.actorId, function(error, data) {  // get player objects
					if (error) return cb();

					returnData.objects = {}
					for (var j = 0; j < data.length; j++)
					{
						returnData.objects[data[j].id] = data[j];
					}

					mithril.obj.getObjectDataByOwner(state, state.actorId, function(err, data) {  // get object dataMulti
						if (err) return cb();

						for (var k=0; k < data.length; k++)
						{
							if (!returnData.objects[data[k].object].data)
							{
								returnData.objects[data[k].object].data = {};
							}

							returnData.objects[data[k].object].data[data[k].property] = data[k].value;
						}

						state.respond(returnData);
						cb();
					});
				});
			}
		);
	});
};

