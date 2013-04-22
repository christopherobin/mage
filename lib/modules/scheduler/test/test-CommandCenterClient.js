var assert = require('assert');
var CommandCenterClient = require('../CommandCenterClient');

var logger = {
	error: console.error,
	debug: console.log,
	log: console.log
};

logger.data = function () {
	return logger;
};

describe('scheduler: CommandCenterClient', function () {
	it('instances should have proper instanceof', function (done) {
		var ccc = new CommandCenterClient({
			app:  'shokoti',
			host: 'shokoti.test-node.wizcorp.jp',
			auth: 'emo6ZW1hZ2Vlcmc='
		}, logger);

		assert.ok(ccc instanceof CommandCenterClient);
		done();
	});

	it('instances should have properly formatted peer', function (done) {
		var ccc1 = new CommandCenterClient({
			app:  'shokoti',
			host: 'shokoti.test-node.wizcorp.jp',
			port: 100,
			auth: 'emo6ZW1hZ2Vlcmc='
		}, logger);

		assert.strictEqual(ccc1.peer, 'http://shokoti.test-node.wizcorp.jp:100');

		var ccc2 = new CommandCenterClient({
			app:  'shokoti',
			host: 'shokoti.test-node.wizcorp.jp',
			auth: 'emo6ZW1hZ2Vlcmc='
		}, logger);

		assert.strictEqual(ccc2.peer, 'http://shokoti.test-node.wizcorp.jp:80');

		done();
	});
});
