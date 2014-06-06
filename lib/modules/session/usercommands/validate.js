var mage = require('../../../mage');

exports.access = 'anonymous';
exports.params = ['sessionKey', 'actorId'];

exports.execute = function (state, sessionKey, actorId, cb) {
    sessionKey = sessionKey || '';
    actorId = actorId || '';

    mage.session.getActorSession(state, actorId, function (err, session) {
        var key = sessionKey.substring(sessionKey.lastIndexOf(':') + 1);

        mage.logger.debug
            .data('key', key)
            .data('session', session || 'none')
            .log('Validating key');

        if (session && session.key === key) {
            state.respond(true);
        } else {
            state.respond(false);
        }

        cb();
    });
};
