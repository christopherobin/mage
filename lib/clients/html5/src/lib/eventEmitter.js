(function () {

	function EventEmitter() {
	}


	window.EventEmitter = EventEmitter;


	EventEmitter.prototype.on = function (evt, fn, prioritize, thisObj) {
		if (typeof fn !== 'function') {
			console.warn('Tried to register non-function', fn, 'as event handler for event:', evt);
			return;
		}

		if (arguments.length < 4 && typeof prioritize === 'object') {
			thisObj = prioritize;
			prioritize = false;
		}

		this.emit('newListener', evt, fn);

		var handler = { fn: fn, thisObj: thisObj };

		var allHandlers = this.eventHandlers;

		if (!allHandlers) {
			this.eventHandlers = allHandlers = {};
			allHandlers[evt] = [handler];
		} else {
			var evtHandlers = allHandlers[evt];

			if (evtHandlers) {
				if (prioritize) {
					evtHandlers.unshift(handler);
				} else {
					evtHandlers.push(handler);
				}
			} else {
				allHandlers[evt] = [handler];
			}
		}
	};


	EventEmitter.prototype.once = function (evt, fn, prioritize, thisObj) {
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
				if (handlers[i].fn === fn) {
					handlers.splice(i, 1);

					// we don't break out of the loop, since the event listener may exist multiple times

					this.emit('removeListener', evt, fn);
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


	EventEmitter.prototype.hasListeners = function (evt) {
		return (this.eventHandlers && this.eventHandlers[evt] && this.eventHandlers[evt].length > 0) ? true : false;
	};


	EventEmitter.prototype.listeners = function (evt) {
		if (this.eventHandlers) {
			var handlers = this.eventHandlers[evt];

			if (handlers) {
				var len = handlers.length;

				var fns = new Array(len);

				for (var i = 0; i < len; i++) {
					fns[i] = handlers[i].fn;
				}

				return fns;
			}
		}

		return [];
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
			var handler = handlers[i];
			var fn = handler.fn;

			var result = fn.apply(handler.thisObj || this, args);

			if (fn.once) {
				if (fn.once > 1) {
					fn.once--;
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

		// remove the once handlers that were executed

		for (i = toRemove.length - 1; i >= 0; i--) {
			handlers.splice(toRemove[i], 1);
		}
	};

}());
