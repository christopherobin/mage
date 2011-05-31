function MithrilIo(mithril)
{
	this.mithril = mithril;
	this.socket = null;
	this.queries = {};
	this.queryId = 0;
	this.eventListeners = [{}, {}];
	this.eventLog = [];
	this.handleBadSession = function(){ alert("Session is bad.") };
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

		var responseCount = result.responses ? result.responses.length : 0;

		if(result.responses && result.responses[0] && result.responses[0][1] && 'sessionError' in result.responses[0][1])
		{	//the horror. TODO: Find a better way to do this.
			_this.handleBadSession();
			return;	
		}

		if (responseCount > 0)
		{
			for (var i=0; i < responseCount; i++)
			{
				_this.receivedQueryResult(result.responses[i], false);
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

		if (responseCount > 0)
		{
			for (var i=0; i < responseCount; i++)
			{
				_this.receivedQueryResult(result.responses[i], true);
			}
		}
	});

	this.socket.connect();
};


MithrilIo.prototype.on = function(path, cb, priority)
{
	var group = priority ? 0 : 1;

	if (!(path in this.eventListeners[group])) this.eventListeners[group][path] = [];

	this.eventListeners[group][path].push({ cb: cb });
};


MithrilIo.prototype.once = function(path, cb, priority)
{
	var group = priority ? 0 : 1;

	if (!(path in this.eventListeners[group])) this.eventListeners[group][path] = [];

	this.eventListeners[group][path].push({ cb: cb, once: true });
};


MithrilIo.prototype.receivedEvent = function(evt)
{
	var path = evt[0];
	var data = evt[1];
	var id   = evt[2];

	var result = null;

	for (var i=0; i < this.eventListeners.length; i++)
	{
		var pathElements = path.split('.');

		do
		{
			var listenerPath = pathElements.join('.');

			var listeners = this.eventListeners[i][listenerPath];

			if (listeners)
			{
				var dropped = false;
				var n = listeners.length;

				for (j=0; j < n; j++)
				{
					var listener = listeners[j];

					result = listener.cb(path, data);

					if (listener.once)
					{
						delete listeners[j];
						dropped = true;
					}

					if (result === false) break;
				}

				if (dropped)
					this.eventListeners[i][listenerPath] = listeners.filter(function(elm) { return elm; });

				if (result === false) return;
			}

			pathElements.pop();
		}
		while (pathElements.length);
	}

	this.eventLog.push(evt);
};


MithrilIo.prototype.receivedQueryResult = function(result, isAfterEvents)
{
	console.log('Received query result', result, isAfterEvents);

	var id = result[0];
	var response = result[1];
	var errors = result[2] || null;

	if (id in this.queries)
	{
		var query = this.queries[id];
		if (query.onAfterEvents == isAfterEvents)
		{
			delete this.queries[id];

			query.cb(errors, response);
		}
	}
};


MithrilIo.prototype.lastEventId = function(path, ignoreId)
{
	ignoreId = parseInt(ignoreId);

	var found = this.eventLog.reduceRight(function(prev, current) {
		// eventlog entry: [ path, data, event ID ]

		if (current[0] !== path) return prev;	// paths don't match, ignore
		if (current[2] === ignoreId) return prev;	// ignored event ID
		if (prev && current[2] < prev[2]) return prev;	// found event is older than the stored one, so ignore

		return current;
	}, null);

	return found;
};


MithrilIo.prototype.send = function(command, parameters, cb, onBeforeEvents)
{
	var obj = { cmd: command, p: parameters };

	if (cb)
	{
		obj.id = ++this.queryId;
		this.queries[obj.id] = { cb: cb, onAfterEvents: !onBeforeEvents };
	}

	console.log('Sending ', obj);

	this.socket.send(JSON.stringify(obj));
};

