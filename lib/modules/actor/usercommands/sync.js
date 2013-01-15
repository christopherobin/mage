var mage = require('../../../mage'),
    objToJson = mage.core.helpers.objToJson;


exports.params = [];


exports.execute = function (state, cb) {
	mage.actor.getActor(state, state.actorId, function (error, actor) {
		if (error) {
			return cb(error);
		}

		mage.actor.getActorProperties(state, state.actorId, { loadAll: true }, function (error, props) {
			if (error) {
				return cb(error);
			}

			var response = '{"me":' + objToJson(actor, { data: props.stringify() }) + '}';
			//var response = '{"me":' + JSON.stringify(actor) + ',"data":' + props.stringify() + '}';

			state.respondJson(response);

			cb();
		});
	});
};

