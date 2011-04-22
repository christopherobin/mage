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

		if (result.id)
		{
			_this.receivedQueryResult(result);
		}
		else
		{
			_this.receivedEvent(result);
		}
	});

	this.socket.connect();
};


MithrilIo.prototype.receivedEvent = function(result)
{
	if (this.mithril[result.module])
	{
		this.mithril[result.module].sysUpdate(result);
	}
};


MithrilIo.prototype.receivedQueryResult = function(result)
{
	console.log('Received query result', result);

	for (var id in this.queries)
	{
		if (id == result.id && id in this.queries)
		{
			var cb = this.queries[id];
			delete this.queries[id];

			cb(result);
			break;
		}
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

