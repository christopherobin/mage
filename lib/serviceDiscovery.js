var mdns = require('node-bj'),
    util = require('util'),
	mithril = require('./mithril');


var hostname = require('os').hostname();


function ServiceDiscovery() {
	this.browsers = {};
}


exports.ServiceDiscovery = ServiceDiscovery;


ServiceDiscovery.prototype.announce = function (serviceName, port, data) {
	var advert = mdns.createAdvertisement(serviceName, port, { host: hostname, txtRecord: data || {} });

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

	listener.call(null, host, port, data);
};
