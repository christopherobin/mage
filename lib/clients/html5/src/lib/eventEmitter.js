(function () {

	function EventEmitter() {
	}


	window.mithril.EventEmitter = EventEmitter;


	EventEmitter.prototype.on = function (evt, fn) {
		this.emit('newListener', fn);

		if (!this.eventHandlers) {
			this.eventHandlers = {};
		}

		var events = this.eventHandlers;

		if (events[evt]) {
			events[evt].push(fn);
		} else {
			events[evt] = [fn];
		}
	};


	EventEmitter.prototype.once = function (evt, fn) {
		fn.once = true;

		this.on(evt, fn);
	};


	EventEmitter.prototype.removeListener = function (evt, fn) {
		if (!this.eventHandlers) {
			this.eventHandlers = {};
		}

		var events = this.eventHandlers;

		if (events[evt]) {
			events[evt] = events[evt].filter(function (item) {
				return item !== fn;
			});
		}
	};


	EventEmitter.prototype.removeAllListeners = function (evt) {
		if (evt) {
			delete this.eventHandlers[evt];
		} else {
			this.eventHandlers = null;
		}
	};


	EventEmitter.prototype.listeners = function (evt) {
		if (!this.eventHandlers) {
			return [];
		}

		return this.eventHandlers[evt] || [];
	};


	EventEmitter.prototype.emit = function (evt) {
		if (!this.eventHandlers) {
			return;
		}

		var handlers = this.eventHandlers[evt];

		if (!handlers) {
			return;
		}

		var args = Array.apply(null, arguments);
		args.shift();

		var toRemove = false;

		for (var i = 0, len = handlers.length; i < len; i++) {
			var fn = handlers[i];

			fn.apply(null, args);

			if (fn.once) {
				fn.remove = true;
				toRemove = true;
				delete fn.once;
			}
		}

		if (toRemove) {
			handlers[evt] = handlers.filter(function (fn) {
				if (!fn.remove) {
					return true;
				}

				delete fn.remove;
				return false;
			});
		}
	};

}());
