function EventManager(servers) {
	this._servers = servers;
}

EventManager.prototype.on =
EventManager.prototype.addEventListener = function (event, fn) {
	for (var i = 0; i < this._servers.length; ++i) {
		this._servers[i].on(event, fn);
	}
};

EventManager.prototype.once = function (event, fn) {
	for (var i = 0; i < this._servers.length; ++i) {
		this._servers[i].once(event, fn);
	}
};


EventManager.prototype.off =
EventManager.prototype.removeListener =
EventManager.prototype.removeAllListeners =
EventManager.prototype.removeEventListener = function (event, fn) {
	for (var i = 0; i < this._servers.length; ++i) {
		this._servers[i].off(event, fn);
	}
};

module.exports = EventManager;
