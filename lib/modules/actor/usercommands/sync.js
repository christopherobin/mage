var mithril = require('../../../mithril');


exports.execute = function (state, p, cb) {
	mithril.actor.getActor(state, state.actorId, function (error, actor) {
		if (error) {
			return cb(error);
		}

		mithril.actor.getActorProperties(state, state.actorId, { loadAll: true }, function (error, props) {
			if (error) {
				return cb(error);
			}

			var response = '{"me":' + JSON.stringify(actor) + '"data":' + props.stringify() + '}';

			state.respond(response);

			cb();
		});
	});
};

