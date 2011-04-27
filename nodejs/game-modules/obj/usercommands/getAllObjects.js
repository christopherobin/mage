exports.execute = function(state, actorId, p, cb)
{
	var returnData = {};
	var collections = null;
	var objects = null;
	var objectProperties = null;
	var collectionMembers = null;

	var sendBackData = function()
	{
		state.msgClient.respond(returnData);	
		cb();
	}
	
	mithril.obj.getActorCollections(state, actorId, ['collectionId', 'parentId', 'collectionType', 'slotCount', 'maxWeight'], {}, function(error, data) {	// get player collections,
		if(!error)
		{
			returnData.collections = {};
			
			for (var i =0; i< data.length; i++)
			{
				var acData = data
				var collectionId = acData[i].collectionId;
				returnData.collections[collectionId] = acData[i];
				returnData.collections[collectionId].members = [];
				
				mithril.obj.getCollectionMembers(state, collectionId, function(err,cMdata){
					for (var l=0;l<cMdata.length;l++)
					{
						returnData.collections[cMdata[l].collection].members.push({id:cMdata[l].object,slot:cMdata[l].slot});
					}
				});
			}
			
			mithril.obj.getActorObjects(state, actorId, function(error, data){  // get player objects
				if(!error)
				{
					returnData.objects = {}					
					for (var j =0; j< data.length; j++)
					{
						returnData.objects[data[j].id] = data[j];
					}
					
					mithril.obj.getObjectDataByOwner(state, actorId, function(err,data) {  // get object dataMulti
						if(!error)
						{ //map data to objects							
							
							for(var k = 0; k< data.length; k++)
							{
								if(!returnData.objects[data[k].object].data)
								{	
									returnData.objects[data[k].object].data = {}; 
								}
								returnData.objects[data[k].object].data[data[k].property] = data[k].value;
							}
							sendBackData();
						}
					});
				}
			});
		}
	});
};

