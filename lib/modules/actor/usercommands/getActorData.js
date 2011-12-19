var mithril = require('../../../mithril');


exports.params = ['actorId'];


exports.execute = function (state, actorId, cb) {
	mithril.actor.getActorProperties(state, actorId, { loadAll: true }, function (error, actor) {
		if (error) {
			return cb(error);
		}

//		console.log('actor >>>>>>>>>>>>>>>>>>>> ', actor);
//		var skillpoints = actor.get('skillPoints');
//		console.log('skillpoints', skillpoints);
//		console.log('actorData >>>>>>>>>>>>>>>>>>>> ', actor.getAll());
//		state.respond();
		cb();
	});
};

