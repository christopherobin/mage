(function (window) {

	var mage = window.mage;
	var EventEmitter = window.EventEmitter;


	function Notification(id, title, message, cb) {
		EventEmitter.call(this);

		this.id = id;
		this.title = title;
		this.message = message;
		this.timestamp = new Date();
		this.cb = cb;
	}

	Notification.prototype = Object.create(EventEmitter.prototype);


	Notification.prototype.render = function () {
		var elm = document.createElement('div');
		elm.className = 'notification';

		if (this.title) {
			var elmTitle = document.createElement('div');
			elmTitle.className = 'title';
			elmTitle.textContent = this.title;

			elm.appendChild(elmTitle);
		}

		if (this.message) {
			var elmMessage = document.createElement('div');
			elmMessage.className = 'message';
			elmMessage.textContent = this.message;

			elm.appendChild(elmMessage);
		}

		if (this.cb) {
			elm.addEventListener('click', this.cb, false);
		}

		return elm;
	};


	function NotificationCenter() {
		EventEmitter.call(this);

		this.lastId = 0;
		this.renderTargets = [];
	}

	NotificationCenter.prototype = Object.create(EventEmitter.prototype);


	function removeFromStack(notification, stack) {
		var index = stack.indexOf(notification);
		if (index !== -1) {
			stack.splice(index, 1);

			notification.emit('close');
		}
	}


	NotificationCenter.prototype.send = function (title, message, cb) {
		var id = this.lastId += 1;

		this.renderTargets.forEach(function (renderTarget) {
			var target = renderTarget.target;
			var options = renderTarget.options;
			var stack = renderTarget.stack;
			var notification;

			function callback() {
				removeFromStack(notification, stack);

				if (cb) {
					cb();
				}
			}

			notification = new Notification(id, title, message, callback);

			stack.unshift(notification);

			target.renderNotification(notification);

			if (options.maxLength) {
				while (stack.length > options.maxLength) {
					removeFromStack(stack[stack.length - 1], stack);
				}
			}

			if (options.ttl) {
				window.setTimeout(function () {
					removeFromStack(notification, stack);
				}, options.ttl);
			}
		});

		return id;
	};


	NotificationCenter.prototype.addRenderTarget = function (renderTarget, options) {
		this.renderTargets.push({
			target: renderTarget,
			options: options || {},
			stack: []
		});
	};


	mage.dashboard.ui.classes.NotificationCenter = NotificationCenter;


}(window));
