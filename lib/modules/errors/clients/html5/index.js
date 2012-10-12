(function (window) {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.errors.construct'));

	mod.setup = function (cb) {
        window.onerror = function (err) {

            var ret, start, stop;

            if (err.message) {
                ret = {
                    name: err.name,
                    stack: err.stack,
                    message: err.message
                };
            }
            else {
                err = window.event;
                start = err.filename.indexOf('/') + 1;
                stop = err.filename.indexOf(':', 7) - start;
                ret = {
                    name:    'UncaughtError',
                    stack:   err.message + '\n    at ' + err.filename.substr(start, stop) + ':' + err.lineno + ':0',
                    file:    err.filename,
                    line:    err.lineno,
                    message: err.message
                };
            }

            ret.message = 'HTML5 Client ' + ret.message;
            console.error('ERROR', arguments, window.event);

            mod.send(ret, function (error, data) {
                console.log('error sent to server for collection');
            });
        };

        cb();
    };

}(window));
