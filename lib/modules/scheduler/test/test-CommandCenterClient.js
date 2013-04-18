var assert = require('assert');
var CommandCenterClient = require('../CommandCenterClient');

describe('scheduler: CommandCenterClient', function () {
	it('CommandCenterClient instances should have proper instanceof', function (done) {
		var ccc = new CommandCenterClient({
			app:  'shokoti',
			host: 'shokoti.test-node.wizcorp.jp',
			auth: 'emo6ZW1hZ2Vlcmc='
		});

		assert.ok(ccc instanceof CommandCenterClient);
		done();
	});
});
