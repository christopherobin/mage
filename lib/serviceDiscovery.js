var mdns = require('node-bj'),
    util = require('util'),
	mithril = require('./mithril');


function ServiceDiscovery(hostname, options) {
	this.hostname = hostname || require('os').hostname();
	this.options = options || {};
	this.browsers = {};
	this.ports = [];
}


exports.ServiceDiscovery = ServiceDiscovery;


ServiceDiscovery.prototype.announce = function (serviceName, port, data) {
	mithril.core.logger.info('Announcing', serviceName, 'at', this.hostname + ':' + port);

	this.ports.push(port);

	var advert = mdns.createAdvertisement(serviceName, port, { host: this.hostname, txtRecord: data || {} });

	advert.start();
};


ServiceDiscovery.prototype.on = function (eventName, listener) {
	var m = eventName.match(/^(.+?)\.(up|down)$/);

	if (m.length !== 3) {
		mithril.core.logger.error('Unknown event: ' + eventName);
		return;
	}

	var serviceName = m[1];
	var action = m[2];


	// create the browser

	var browser = this.browsers[serviceName];
	if (!browser) {
		mithril.core.logger.info('Starting mdns browser', serviceName);

		browser = this.browsers[serviceName] = mdns.createBrowser(serviceName);
		browser.start();
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

	if (!this.options.allowSelfDiscovery) {
		var parsedHost = host;

		// strip trailing dot from the hostname

		if (parsedHost[parsedHost.length - 1] === '.') {
			parsedHost = parsedHost.substring(0, parsedHost.length - 1);
		}

		if (parsedHost === this.hostname && this.ports.indexOf(port) !== -1) {
			mithril.core.logger.debug('own mdns service notice ignored');
			return;
		}
	}

	mithril.core.logger.debug('mdns service up/down notice', info);

	listener.call(null, host, port, data);
};
