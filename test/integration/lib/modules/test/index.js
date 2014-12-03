var mage = require('mage');


exports.setup = function (state, callback) {
	return callback();
};


mage.core.httpServer.addRoute('/stallforever', function (req, res, path, query) {
	if (query.test === 'void') {
		return;
	}

	if (query.test === 'headers') {
		res.writeHead(200, { 'content-type': 'text/plain' });
		return;
	}

	if (query.test === 'somedata') {
		res.writeHead(200, { 'content-type': 'text/plain' });
		res.write('Hello ');
		res.write('world');
		return;
	}

	if (query.test === 'alldata') {
		res.writeHead(200, { 'content-type': 'text/plain' });
		res.end('Hello world');
		return;
	}
}, 'simple');
