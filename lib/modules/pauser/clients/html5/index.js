(function (window) {

	var mage = window.mage;

	var mod = mage.registerModule($html5client('module.pauser.construct'));


	var waiters = [];
	var started = {};


	function isWaitRequired(contexts) {
		for (var i = 0, len = contexts.length; i < len; i++) {
			if (started[contexts[i]]) {
				return true;
			}
		}

		return false;
	}


	function Waiter(contexts, fn, timeout) {
		this.contexts = contexts;
		this.fn = fn;

		if (typeof timeout === 'number') {
			var that = this;

			this.timer = window.setTimeout(function () {
				that.trigger();
			}, timeout);
		}
	}


	Waiter.prototype.trigger = function () {
		if (this.fn) {
			this.fn();
			this.fn = null;

			// remove the timer

			if (this.timer) {
				window.clearTimeout(this.timer);
				this.timer = null;
			}

			// remove from waiters list

			var index = waiters.indexOf(this);
			if (index !== -1) {
				waiters.splice(index, 1);
			}
		}
	};


	Waiter.prototype.contextEnded = function (name) {
		var len = this.contexts.length;

		if (len === 1 && this.contexts[0] === name) {
			// hot path: context was the only one

			this.trigger();
		} else if (!isWaitRequired(this.contexts)) {
			// none of the contexts we're waiting for has been started

			this.trigger();
		}
	};


	mod.start = function (context) {
		started[context] = true;
	};


	mod.end = function (context) {
		started[context] = false;

		// since waiters can unregister themselves, we need to make a copy of the array for safe iteration

		var list = waiters.slice(0);

		for (var i = 0, len = list.length; i < len; i++) {
			list[i].contextEnded(context);
		}
	};


	mod.wait = function (contexts, fn, timeout) {
		if (!Array.isArray(contexts)) {
			contexts = [contexts];
		}

		if (!isWaitRequired(contexts)) {
			fn();
		} else {
			waiters.push(new Waiter(contexts, fn, timeout));
		}
	};

}(window));
