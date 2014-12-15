var mage = require('mage');
var path = require('path');

exports.execute = function (state, cb) {
	mage.core.httpServer.serveFile('/foo.txt', path.join(__dirname, '../foo.txt'));
	mage.core.httpServer.serveFile('/404.txt', path.join(__dirname, '../404.txt'));

	setImmediate(cb);
};
