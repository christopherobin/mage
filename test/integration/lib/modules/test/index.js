var mage = require('mage');
var assert = require('assert');
var path = require('path');


exports.setup = function (state, callback) {
	return callback();
};


// expose a file

mage.core.httpServer.serveFile('/foo.txt', path.join(__dirname, 'foo.txt'));

// expose a non existing file

mage.core.httpServer.serveFile('/404.txt', path.join(__dirname, '404.txt'));

// expose an endpoint that behaves badly

mage.core.httpServer.addRoute('/stallforever', function (req, res, path, query) {
	if (query.test === 'void') {
		assert.notEqual(req.headers.connection, 'close');
		return;
	}

	if (query.test === 'headers') {
		assert.notEqual(req.headers.connection, 'close');

		res.writeHead(200, { 'content-type': 'text/plain' });
		return;
	}

	if (query.test === 'somedata') {
		assert.notEqual(req.headers.connection, 'close');

		res.writeHead(200, { 'content-type': 'text/plain' });
		res.write('Some ');
		res.write('Fragmented ');
		res.write('Data');
		return;
	}

	if (query.test === 'alldata') {
		assert.notEqual(req.headers.connection, 'close');

		res.writeHead(200, { 'content-type': 'text/plain' });
		res.end('KeepAlive');
		return;
	}

	if (query.test === 'close') {
		assert.equal(req.headers.connection, 'close');

		res.writeHead(200, { 'content-type': 'text/plain' });
		res.end('Closed');
		return;
	}
}, 'simple');
