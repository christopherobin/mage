var CommandCenterClient = require('../CommandCenterClient');

exports['is instance of CommandCenterClient'] = function (test) {
	test.expect(1);

	var ccc = new CommandCenterClient({
		app:  'shokoti',
		host: 'shokoti.test-node.wizcorp.jp',
		auth: 'emo6ZW1hZ2Vlcmc='
	});

	test.ok(ccc instanceof CommandCenterClient);
	test.done();
};