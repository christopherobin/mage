var mage = require('../');
var WebApp = require('../lib/app/web').WebApp;

mage.addModulesPath(__dirname + '/modules');

mage.setup(function (err) {
	if (err) {
		process.send({ type: 'error', error: err });
		return;
	}
	mage.useModules('test', 'ident', 'session');
	mage.setupModules(function (err) {
		if (err) {
			process.send({ type: 'error', error: err });
			return;
		}
		var app = new WebApp('test', {
			access: 'user'
		});
		app.getCommandCenter().setup();
		app.exposeOnClientHost();
		mage.core.msgServer.startClientHost(function (err) {
			if (err) {
				process.send({ type: 'error', error: err });
				return;
			}
			process.send({
				type: 'ready',
				address: mage.core.msgServer.getHttpServer().server.address()
			});
		});
	});
});
