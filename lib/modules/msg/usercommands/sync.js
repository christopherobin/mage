var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, cb) {
	mithril.msg.loadInbox(state, state.actorId, function (error, inbox) {
		if (!error) {
			state.respond({ inbox: inbox });
		}

		cb();
	});
};

