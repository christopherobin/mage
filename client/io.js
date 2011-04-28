function MithrilIo(mithril)
{
	this.mithril = mithril;
	this.socket = null;
	this.queries = {};
	this.queryId = 0;
	this.eventListeners = {};
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

		if (result.responses)
		{
			var n = result.responses.length;
			for (var i=0; i < n; i++)
			{
				_this.receivedQueryResult(result.responses[i]);
			}
		}

		if (result.events)
		{
			var n = result.events.length;
			for (var i=0; i < n; i++)
			{
				_this.receivedEvent(result.events[i]);
			}
		}

		if (result.errors)
		{
			// TODO
		}
	});

	this.socket.connect();
};


MithrilIo.prototype.on = function(path, cb)
{
	if (!(path in this.eventListeners)) this.eventListeners[path] = [];

	this.eventListeners[path].push({ cb: cb });
};


MithrilIo.prototype.once = function(path, cb)
{
	if (!(path in this.eventListeners)) this.eventListeners[path] = [];

	this.eventListeners[path].push({ cb: cb, once: true });
};


MithrilIo.prototype.receivedEvent = function(evt)
{
	var path = evt[0];
	var data = evt[1];

	var pathElements = path.split('.');

	var mod = this.mithril[pathElements[0]];

	var emit = true;

	if (mod && mod.on)
	{
		if (false === mod.on(path, data)) emit = false;
	}

	if (emit)
	{
		do
		{
			var listenerPath = pathElements.join('.');

			var listeners = this.eventListeners[listenerPath];

			if (listeners)
			{
				var dropped = false;
				var n = listeners.length;

				for (i=0; i < n; i++)
				{
					var listener = listeners[i];

					listener.cb(path, data);

					if (listener.once)
					{
						delete listeners[i];
						dropped = true;
					}
				}

				if (dropped)
					this.eventListeners[listenerPath] = listeners.filter(function(elm) { return elm; });
			}

			pathElements.pop();
		}
		while (pathElements.length);
	}
};


MithrilIo.prototype.receivedQueryResult = function(result)
{
	console.log('Received query result', result);

	var id = result[0];
	var response = result[1];
	var errors = (result.length >= 3) ? result[2] : null;

	if (id in this.queries)
	{
		var cb = this.queries[id];
		delete this.queries[id];

		cb(errors, response);
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

