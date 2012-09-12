var mdns = require('mdns'),
    util = require('util'),
	mithril = require('./mithril'),
    logger = mithril.core.logger;


function ServiceDiscovery(hostname, options) {
	this.hostname = hostname || require('os').hostname();
	this.options = options || {};
	this.browsers = {};
	this.ports = [];
}


exports.ServiceDiscovery = ServiceDiscovery;


ServiceDiscovery.prototype.announce = function (serviceName, port, data) {
	logger.info('Announcing', serviceName, 'at', this.hostname + ':' + port);

	if (serviceName.length > 14) {
		logger.error('ServiceDiscovery serviceName cannot be more than 14 characters.');
		return;
	}

	try {
		var advert = mdns.createAdvertisement(mdns.tcp(serviceName), port, { host: this.hostname, txtRecord: data || {} });

		advert.start();

		mithril.once('shutdown', function () {
			logger.info('Stopping mdns advertisement', serviceName);
			advert.stop();
		});

		this.ports.push(port);
	} catch (e) {
		logger.error(e.stack || e);
	}
};


ServiceDiscovery.prototype.on = function (eventName, listener) {
	var m = eventName.match(/^(.+?)\.(up|down)$/);

	if (m.length !== 3) {
		logger.error('Unknown event: ' + eventName);
		return;
	}

	var serviceName = m[1];
	var action = m[2];


	// sanity check

	if (serviceName.length > 14) {
		logger.error('ServiceDiscovery serviceName cannot be more than 14 characters.');
		return;
	}

	// create the browser

	var browser = this.browsers[serviceName];
	if (!browser) {
		logger.info('Starting mdns browser', serviceName);

		browser = this.browsers[serviceName] = mdns.createBrowser(mdns.tcp(serviceName));
		browser.start();

		mithril.once('shutdown', function () {
			logger.info('Stopping mdns browser', serviceName);
			browser.stop();
		});
	}

	if (action === 'up') {
		browser.on('serviceUp',   this.serviceEvent.bind(this, listener));
	} else {
		browser.on('serviceDown', this.serviceEvent.bind(this, listener));
	}
};


ServiceDiscovery.prototype.serviceEvent = function (listener, info, flags) {
	var host = info.host;
	var port = info.port;
	var data = info.txtRecord || {};

	// ignore self discovery, unless specifically required

	if (host && !this.options.allowSelfDiscovery) {
		var parsedHost = host;

		// strip trailing dot from the hostname

		if (parsedHost[parsedHost.length - 1] === '.') {
			parsedHost = parsedHost.substring(0, parsedHost.length - 1);
		}

		if (parsedHost === this.hostname && this.ports.indexOf(port) !== -1) {
			logger.debug('own mdns service notice ignored');
			return;
		}
	}

	logger.debug('mdns service up/down notice', info);

	listener.call(null, host, port, data);
};

