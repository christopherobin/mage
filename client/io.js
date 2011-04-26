function MithrilIo(mithril)
{
	this.mithril = mithril;
	this.socket = null;
	this.queries = {};
	this.queryId = 0;
}


MithrilIo.prototype.start = function(cb)
{
	this.socket = new io.Socket(this.mithril.config.host, { port: this.mithril.config.port, rememberTransport: false });

	var _this = this;

	this.socket.on('connect', function() {
		_this.socket.send(JSON.stringify({ sessionId: _this.mithril.sessionId }));

		if (cb)
		{
			cb();
			cb = null;
		}
	});

	this.socket.on('message', function(result) {
		console.log('Received message: ' + result);

		result = JSON.parse(result);

		if (result.id && result.response)
		{
			_this.receivedQueryResult(result.response);
		}

		if (result.events)
		{
			var n = result.events.length;
			while (n--)
			{
				var evt = result.events[n];
				_this.receivedEvent(evt[0], evt[1]);
			}
		}
	});

	this.socket.connect();
};


MithrilIo.prototype.receivedEvent = function(module, data)
{
	if (this.mithril[module])
	{
		this.mithril[module].sysUpdate(data);
	}
	else
	{
		console.log('Module ' + module + ' has no sysUpdate() method to handle events.');
	}
};


MithrilIo.prototype.receivedQueryResult = function(result)
{
	console.log('Received query result', result);

	if (result.id in this.queries)
	{
		var cb = this.queries[result.id];
		delete this.queries[result.id];

		cb(result);
	}
};


MithrilIo.prototype.send = function(command, parameters, cb)
{
	var obj = { cmd: command, p: parameters };

	if (cb)
	{
		obj.id = ++this.queryId;
		this.queries[obj.id] = cb;
	}

	console.log('Sending ', obj);

	this.socket.send(JSON.stringify(obj));
};

