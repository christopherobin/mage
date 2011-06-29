function MithrilIo(mithril)
{
	this.mithril = mithril;
	this.socket = null;
	this.queries = {};
	this.queryId = 0;
	this.eventListeners = [{}, {}];
	this.eventLog = [];

	this.sessionSent = false;

	this.ERR_RESTART = 1;
	this.ERR_INTERNAL = 100;
}


MithrilIo.prototype.handleErrors = function(errorCodes)
{
	var msg;

	if (errorCodes.indexOf(this.ERR_RESTART) != -1)
	{
		msg = 'You have timed out, or there is a problem with your connection. Please restart the game.';
	}
	else
	{
		msg = 'Error while trying to execute your request. Please try again. If the problem persists, please check your connection and try restarting the game.';
	}

	alert(msg);
};


MithrilIo.prototype.start = function(cb)
{
	this.socket = new io.Socket(this.mithril.config.host, { port: this.mithril.config.port, rememberTransport: false });

	var _this = this;

	this.socket.on('connect', function() {
		_this.sessionSent = false;

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

	var len = this.eventListeners.length;

	for (var i=0; i < len; i++)
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

					if (listener.once && result !== false)
					{
						delete listener.cb;
						delete listeners[j];
						dropped = true;
					}
				}

				if (dropped)
					this.eventListeners[i][listenerPath] = listeners.filter(function(elm) { return elm; });
			}

			pathElements.pop();
		}
		while (pathElements.length);
	}

	this.eventLog.push(evt);
};


MithrilIo.prototype.receivedQueryResult = function(result, isAfterEvents)
{
	var id = result[0];
	var response = result[1];
	var errors = result[2] || null;

	if (id in this.queries)
	{
		var query = this.queries[id];
		if (query.onAfterEvents == isAfterEvents)
		{
			delete this.queries[id];

			console.log('Received query result', result, isAfterEvents);

			if (errors)
			{
				this.handleErrors(errors);
			}

			query.cb(errors, response);
			delete query.cb;
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

	if (!this.sessionSent)
	{
		obj.sessionId = this.mithril.sessionId;
		this.sessionSent = true;
	}

	console.log('Sending', obj);

	this.socket.send(JSON.stringify(obj));
};

