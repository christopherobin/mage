function MsgClient(client) {
	this.client = client;
	this.responses = [];
	this.events = [];
	this.eventCount = 0;
}


exports.MsgClient = MsgClient;


MsgClient.prototype.unbind = function () {
	this.client = null;
};


MsgClient.prototype.rebind = function (client) {
	this.client = client;
};


MsgClient.prototype.respond = function (id, response, errors) {
	var out = [id, response];

	if (errors) {
		out.push(errors);
	}

	this.responses.push(out);
};


MsgClient.prototype.emit = function (path, data) {
	this.events.push([path, data, ++this.eventCount]);
};


MsgClient.prototype.emitAsync = function (path, data) {
	/* This method emits an event directly to the client, without that event becoming part of the transaction */

	if (!this.client) {
		return;
	}

	var o = { events: [ [path, data, ++this.eventCount] ] };

	this.client.send(JSON.stringify(o));
};


MsgClient.prototype.send = function () {
	if (!this.client) {
		return;
	}

	var o = {};

	if (this.events.length > 0)
	{
		o.events = this.events;
		this.events = [];
	}

	if (this.responses.length > 0)
	{
		o.responses = this.responses;
		this.responses = [];
	}

	this.client.send(JSON.stringify(o));
};


MsgClient.prototype.cleanup = function () {
	this.client = null;
	this.responses = [];
	this.events = [];
};

