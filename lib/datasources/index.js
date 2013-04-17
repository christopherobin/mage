var mage = require('../mage'),
    async = require('async'),
    EventEmitter = require('events').EventEmitter,
    MySqlDatabase = require('./mysql').MySqlDatabase,
    MembaseStore = require('./membase').MembaseStore;

exports = module.exports = new EventEmitter();

var closeAllTimeout = 5 * 1000;

var counter = new EventEmitter();
counter.n = 0;

counter.get = function () {
	return this.n;
};

counter.inc = function () {
	this.n += 1;
	this.emit('count', this.n);
	exports.emit('datasourceConnect');
};

counter.dec = function () {
	this.n -= 1;
	this.emit('count', this.n);
	exports.emit('datasourceDisconnect');
};


function DataSources(state) {
	counter.inc();

	this.connectors = [];

	var data = mage.core.config.get('data');

	if (data) {
		for (var name in data) {
			var dsConfig = data[name];
			var obj;

			if (dsConfig.type === 'mysql') {
				obj = new MySqlDatabase(state, dsConfig);
			}

			if (dsConfig.type === 'membase') {
				obj = new MembaseStore(state, dsConfig);
			}

			if (obj) {
				this[name] = obj;
				this.connectors.push({ name: name, obj: obj });
			}
		}
	}
}


DataSources.prototype.autoTransaction = function (rules) {
	// rules: { write: true, read: false }

	for (var i = 0, len = this.connectors.length; i < len; i++) {
		this.connectors[i].obj.autoTransaction(rules);
	}
};


DataSources.prototype.commit = function (cb) {
	// commit all datasources in parallel

	async.forEach(
		this.connectors,
		function (conn, callback) {
			conn.obj.commit(callback);
		},
		function (error) {
			cb(error);
		}
	);
};


DataSources.prototype.rollBack = function (cb) {
	// rollback all datasources in parallel

	async.forEach(
		this.connectors,
		function (conn, callback) {
			conn.obj.rollBack(callback);
		},
		function (error) {
			cb(error);
		}
	);
};


DataSources.prototype.close = function () {
	// close any existing connections on this Data collection

	for (var i = 0, len = this.connectors.length; i < len; i++) {
		var conn = this.connectors[i];

		conn.obj.close();
		delete this[conn.name];
	}

	this.connectors = [];
	counter.dec();
};


exports.close = function (cb) {
	// stops new datasources from being instantiated
	// waits for all datasources to close, and then calls cb

	mage.core.logger.debug('Closing all datasources...');

	var closing = false;

	function closeAll() {
		if (closing) {
			return;
		}

		closing = true;

		require('./membase').close(function () {
			if (cb) {
				cb();
				cb = null;
			}
		});
	}

	if (counter.get() < 1) {
		closeAll();
		return;
	}

	counter.on('count', function (n) {
		if (n < 1) {
			counter.removeAllListeners();
			closeAll();
		}
	});

	if (closeAllTimeout) {
		setTimeout(function () {
			mage.core.logger.alert('Failed to gracefully close all datasources (some are still open), timing out.');
			closeAll();
		}, closeAllTimeout);
	}
};


exports.DataSources = DataSources;

