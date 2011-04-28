function MsgClient(client)
{
	this.client = client;
	this.responses = [];
	this.events = [];
	this.errors = [];
}


exports.MsgClient = MsgClient;


MsgClient.prototype.unbind = function()
{
	this.client = null;
};


MsgClient.prototype.rebind = function(client)
{
	this.client = client;
};


MsgClient.prototype.error = function(code)
{
	this.errors.push(code);
};


MsgClient.prototype.respond = function(id, response)
{
	this.responses.push([id, response]);
};


MsgClient.prototype.emit = function(path, data)
{
	this.events.push([path, data]);
};


MsgClient.prototype.send = function()
{
	if (!this.client) return;

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

	if (this.errors.length > 0)
	{
		o.errors = this.errors;
		this.errors = [];
	}

	this.client.send(JSON.stringify(o));
};


MsgClient.prototype.cleanup = function()
{
	this.client = null;
	this.responses = [];
	this.events = [];
	this.errors = [];
};

