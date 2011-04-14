
if (app.config && app.config.data)
{
	for (var name in app.config.data)
	{
		var config = app.config.data[name];

		switch (config.type)
		{
			case 'mysql': DataSources.prototype[name] = new MySqlDatabase(config); break;
		}
	}
}


function DataSources()
{
	this.connectors = [];


	if (app.config && app.config.data)
	{
		for (var name in app.config.data)
		{
			var config = app.config.data[name];
			var obj = null;

			switch (config.type)
			{
				case 'mysql': obj = new MySqlDatabase(config); break;
			}

			if (obj)
			{
				this[name] = obj;
				this.connectors.push({ name: name, obj: obj });
			}
		}
	}
}


DataSources.prototype.close = function()
{
	// close any existing connections on this Data collection

	var len = this.connectors.length;

	while (len--)
	{
		var conn = this.connectors[len];

		conn.obj.close();
		delete this[conn.name];
	}

	this.connectors = [];
};


var mysql = null;

function connectToMySql(config)
{
	if (mysql === null) mysql = require(app.paths.extlib + '/mysql');

	var client = new mysql.Client();
	client.user = config.user;
	client.password = config.pass;
	client.host = config.host;
	client.port = config.port;
	client.database = config.dbname;
	client.connect(function() { app.log.debug('Connected to MySQL server at ' + client.host + ':' + client.port); });
	return client;
}


function MySqlDatabase(config)
{
	this.config = config;
	this.inTransaction = false;
	this.connRW = null;
	this.connRO = null;
}


MySqlDatabase.prototype.close = function()
{
	if (this.connRO && this.connRO !== this.connRW)
	{
		this.connRO.end();
		this.connRO = null;
	}

	if (this.connRW)
	{
		this.connRW.end();
		this.connRW = null;
	}
};


MySqlDatabase.prototype.get = function(readonly)
{
	if (this.inTransaction)
	{
		return this.rw();
	}

	return readonly ? this.ro() : this.rw();
};


MySqlDatabase.prototype.ro = function()
{
	if (this.connRO === null)
	{
		if ('ro' in this.config)
			this.connRO = connectToMySql(this.config.ro);
		else
			this.connRO = this.rw();
	}

	return this.connRO;
};


MySqlDatabase.prototype.rw = function()
{
	if (this.connRW === null)
	{
		this.connRW = connectToMySql(this.config.rw);
	}

	return this.connRW;
};


MySqlDatabase.prototype.beginTransaction = function(cb)
{
	if (this.inTransaction)
	{
		if (cb) cb(errors.ALREADY_IN_TRANSACTION);
	}
	else
	{
		var _this = this;

		this.get(false).query('BEGIN TRANSACTION', [], function(err, results) {
			if (err)
			{
				cb(errors.DB_ERROR);
			}
			else
			{
				_this.inTransaction = true;
				if (cb) cb(null);
			}
		});
	}
};


MySqlDatabase.prototype.commit = function(cb)
{
	if (!this.inTransaction)
	{
		if (cb) cb(errors.NOT_IN_TRANSACTION);
	}
	else
	{
		var _this = this;

		this.get(false).query('COMMIT', [], function(err, results) {
			if (err)
			{
				cb(errors.DB_ERROR);
			}
			else
			{
				_this.inTransaction = false;
				if (cb) cb(null);
			}
		});
	}
};


MySqlDatabase.prototype.rollBack = function(cb)
{
	if (!this.inTransaction)
	{
		if (cb) cb(errors.NOT_IN_TRANSACTION);
	}
	else
	{
		var _this = this;

		this.get(false).query('ROLLBACK', [], function(err, results) {
			if (err)
			{
				cb(errors.DB_ERROR);
			}
			else
			{
				_this.inTransaction = false;
				if (cb) cb(null);
			}
		});
	}
};


MySqlDatabase.prototype.getOne = function(sql, params, error, cb)
{
	this.source(true).query(sql, params, function(err, results) {
		if (err || results.length != 1)
		{
			cb(error);
		}
		else
		{
			cb(null, results[0]);
		}
	});
};


MySqlDatabase.prototype.getMany = function(sql, params, error, cb)
{
	this.source(true).query(sql, params, function(err, results) {
		if (err)
		{
			cb(error);
		}
		else
		{
			cb(null, results);
		}
	});
};


MySqlDatabase.prototype.exec = function(sql, params, error, cb)
{
	this.source(false).query(sql, params, function(err, results) {
		// not sure yet
	});
};


datasources.db.getOne();


/*
function createMySqlConnector(name, config)
{
	DataSources.prototype[name] = function(readonly)
	{
		var conn = this.connectors.mysql;
		var dbId;

		if (readonly && config.ro)
		{
			if (conn.rw !== null) return conn.rw;

			dbId = 'ro';
		}
		else
			dbId = 'rw';

		if (conn[dbId] === null)
		{
			conn[dbId] = { source: connectToMySql(config[dbId]), };
		}

		return conn[dbId];
	};
}
*/



exports.DataSources = DataSources;

