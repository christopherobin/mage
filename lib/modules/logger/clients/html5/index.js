(function (window) {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.logger.construct'));

	mod.setup = function (cb) {

        mod._channelToLocalLoggerMap = {
            'warning'   : console.warn,
            'error'     : console.error,
            'critical'  : console.error,
            'debug'     : console.debug,
            'info'      : console.info
        };

        mod._mandatoryChannels = ['warning', 'error', 'critical'];
        mod._channels = [];

        window.addEventListener('error', function (err) {

            var ret,
                start,
                stop;

            err = window.event;
            start = err.filename.indexOf('/') + 1;
            stop = err.filename.indexOf(':', 7) - start;
            ret = {
                name:    'UncaughtError',
                stack:   err.message
                            + '\n    at '
                            + err.filename.substr(start, stop)
                            + ':'
                            + err.lineno
                            + ':0',
                file:    err.filename,
                line:    err.lineno,
                message: err.message
            };

            mod._sendLog('critical', ret);
        });

        mod.sync(function (err, data) {

            var allChannels = data.allChannels,
                channelList = data.channelList;
            // First, silence ALL channels
            for (var a = 0; a < allChannels.length; a++) {
                mod._unsetChannelFunction(allChannels[a]);
            }

            // Then, set channels for mandatory log listener
            for (var m = 0; m < mod._mandatoryChannels.length; m++) {
                mod._setChannelFunction(mod._mandatoryChannels[m]);
            }

            mod._resetChannels(channelList);
            cb();
        });
    };

    mod.getChannelList = function () {
        return mod._mandatoryChannels.concat(mod._channels);
    };

    mod._sendLog = function (channel, message, data) {

        if (message[0] instanceof Error) {
            message = {
                name: message.name,
                stack: message.stack,
                message: message.message
            };
        }
        else {
            message = message.join(' ');
        }

        mod.log('html5', channel, message, data, function (error, data) {
            if (error) {
                console.error('Could not forward logs to remote server');
            }
        });
    };

    mod._resetChannels = function (channelList) {

        channelList = mod._channels.filter(function (val) {
            if (channelList.indexOf(val) === -1) {
                mod._unsetChannelFunction(val);
                return false;
            }

            if (mod._mandatoryChannels.indexOf(val) > -1) {
                return false;
            }

            return true;
        });

        for (var c = 0; c < channelList.length; c++) {
            mod._setChannelFunction(channelList[c]);
        }

        mod._channels = channelList;
    };

    mod._setChannelFunction = function (channel) {

        var localLog = mod._channelToLocalLoggerMap[channel];

        if (!localLog) {
            localLog = console.log;
        }

        mod[channel] = function () {
            var args = Array.prototype.slice.call(arguments);

            mod._sendLog(channel, args);

            args.unshift(channel);

            localLog.apply(console, args);
        };
    };

    mod._unsetChannelFunction = function (channel) {
        mod[channel] = function () {};
    };
}(window));
