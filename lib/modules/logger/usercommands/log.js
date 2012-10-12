var logger = require('../index');

exports.params = ['client', 'channel', 'message', 'data'];

exports.execute = function (state, client, channel, message, data, cb) {
    if (logger.has(channel)) {
        logger[channel](message).data({
            client: client,
            actorId: state.actorId,
            language: state.session.language,
            version: state.session.version
        });

        state.respond('stored');
    }
    else {
        state.respond('disabled');
    }

    cb();
};

