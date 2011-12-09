(function () {

	function EventEmitter() {
	}


	window.EventEmitter = EventEmitter;


	EventEmitter.prototype.on = function (evt, fn, prioritize) {
		this.emit('newListener', evt, fn);

		var allHandlers = this.eventHandlers;

		if (!allHandlers) {
			this.eventHandlers = allHandlers = {};
			allHandlers[evt] = [fn];
		} else {
			var evtHandlers = allHandlers[evt];

			if (evtHandlers) {
				if (prioritize) {
					evtHandlers.unshift(fn);
				} else {
					evtHandlers.push(fn);
				}
			} else {
				allHandlers[evt] = [fn];
			}
		}
	};


	EventEmitter.prototype.once = function (evt, fn, prioritize) {
		fn.once = 1 + (fn.once >>> 0);

		this.on(evt, fn, prioritize);
	};


	EventEmitter.prototype.removeListener = function (evt, fn) {
		if (!this.eventHandlers) {
			return;
		}

		var handlers = this.eventHandlers[evt];

		if (handlers) {
			for (var i = handlers.length - 1; i >= 0; i--) {
				if (handlers[i] === fn) {
					handlers.splice(i, 1);

					// we don't break out of the loop, since the event listener may exist multiple times
				}
			}
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

		var toRemove = [];

		for (var i = 0, len = handlers.length; i < len; i++) {
			var fn = handlers[i];

			var result = fn.apply(null, args);

			var once = fn.once;

			if (once) {
				if (once > 1) {
					fn.once = once - 1;
				} else {
					delete fn.once;
				}

				toRemove.push(i);
			}

			if (result === false) {
				// cancelBubble
				break;
			}
		}

		// remve the once handlers that were executed

		for (i = toRemove.length - 1; i >= 0; i--) {
			handlers.splice(i, 1);
		}
	};

}());
