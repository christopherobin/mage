var logger = require('../../../logger');

exports.params = [];

exports.execute = function (state, cb) {

    var ret     = {
        allChannels    : Object.keys(logger.existingChannels),
        channelList    : state.channels || []
    };

    state.respond(ret);

    cb();
};

