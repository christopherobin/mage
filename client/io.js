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
		console.log('Received message: ', result);

		result = JSON.parse(result);

		if (result.id)
		{
			_this.receivedQueryResult(result);
		}

		if (result.events)
		{
			var n = result.events.length;
			for (var i=0; i < n; i++)
			{
				var evt = result.events[i];
				_this.receivedEvent(evt[0], evt[1]);
			}
		}
	});

	this.socket.connect();
};


MithrilIo.prototype.receivedEvent = function(module, data)
{
	var mod = this.mithril[module];

	if (mod && mod.sysUpdate)
	{
		mod.sysUpdate(data);
	}
	else
	{
		console.log('Module ' + module + ' has no sysUpdate() method to handle events.');
	}
};


MithrilIo.prototype.receivedQueryResult = function(result)
{
	console.log('Received query result', result.id, result.response);

	if (result.id in this.queries)
	{
		var cb = this.queries[result.id];
		delete this.queries[result.id];

		var errors = result.errors || null;

		if ('response' in result)
			cb(errors, result.response);
		else
			cb(errors, null);
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

