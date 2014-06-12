var assert = require('assert');
var CommandCenterClient = require('../../lib/commandCenterClient').CommandCenterClient;

var logger = {
	error: console.error,
	debug: console.log,
	log: console.log
};

logger.data = function () {
	return logger;
};

describe('CommandCenterClient', function () {
	it('instances should have proper instanceof', function (done) {
		var ccc = new CommandCenterClient('myApp', {
			hostname: 'example.com',
			auth: 'henk:stubbe'
		}, logger);

		assert.ok(ccc instanceof CommandCenterClient);
		done();
	});

	it('instances should have properly formatted peer', function (done) {
		var ccc1 = new CommandCenterClient('myApp', {
			hostname: 'example.com',
			auth: 'henk:stubbe',
			port: 100
		}, logger);

		assert.strictEqual(ccc1.peer, 'http://henk:stubbe@example.com:100');

		var ccc2 = new CommandCenterClient('myApp', {
			hostname: 'example.com',
			auth: 'henk:stubbe',
			pathname: '/foo'
		}, logger);

		assert.strictEqual(ccc2.peer, 'http://henk:stubbe@example.com/foo');

		done();
	});
});
