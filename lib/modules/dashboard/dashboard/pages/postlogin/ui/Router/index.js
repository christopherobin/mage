function Router() {
	this.currentRoute = window.location.hash.substring(1);
	this.listeners = [];

	var that = this;

	window.addEventListener('hashchange', function () {
		// Triggers for this event: any hash change!
		// That includes:
		// - browser back/forward navigation,
		// - calling router.set(route),
		//
		// Some listeners will trigger a flow that will try to set the route to something it already
		// is. That means that this event listener will fire again! We'll be fine however, because
		// that always happens after history back/forward has changed the URL first. In other words,
		// setting the route to something it already is is a no-op and will have no effect.

		var newRoute = window.location.hash.substring(1);

		if (that.currentRoute === newRoute) {
			// this prevents event listeners to fire when this hash is being pushed
			return;
		}

		that.currentRoute = newRoute;

		that.broadcast();
	});
}

Router.prototype.broadcast = function () {
	// make copies, so that listeners can modify them without too many side effects

	var listeners = this.listeners.slice();
	var route = this.currentRoute;

	for (var i = 0; i < listeners.length; i++) {
		var m = route.match(listeners[i].route);

		if (m) {
			listeners[i].cb(m, route);
		}
	}
};


Router.prototype.listen = function (route, cb) {
	this.listeners.push({ route: route, cb: cb });
};


Router.prototype.set = function (route) {
	if (this.currentRoute !== route) {
		window.location.hash = '#' + route;
	}
};


Router.prototype.replace = function (route) {
	if (this.currentRoute !== route) {
		window.location.replace('#' + route);
	}
};


Router.prototype.getCurrent = function () {
	return this.currentRoute;
};


module.exports = Router;
