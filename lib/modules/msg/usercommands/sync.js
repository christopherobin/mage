var mage = require('../../../mage');


exports.params = [];


exports.execute = function (state, cb) {
	mage.msg.loadInbox(state, state.actorId, function (error, inbox) {
		if (!error) {
			state.respond({ inbox: inbox });
		}

		cb();
	});
};

