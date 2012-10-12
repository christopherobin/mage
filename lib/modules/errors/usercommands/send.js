var mithril = require('../../../mithril');

exports.params = ['errorMessage'];

exports.execute = function (state, errorMessage, cb) {
    mithril.core.logger.critical(errorMessage).data({
        client: true,
        actorId: state.actorId,
        language: state.session.language,
        version: state.session.version
    });

    cb();
};

