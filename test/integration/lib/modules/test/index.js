var mage = require('mage');
var assert = require('assert');


exports.setup = function (state, callback) {
	return callback();
};


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
