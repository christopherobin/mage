
if (mithril.config && mithril.config.data)
{
	for (var name in mithril.config.data)
	{
		var config = mithril.config.data[name];

		switch (config.type)
		{
			case 'mysql': DataSources.prototype[name] = new MySqlDatabase(config); break;
		}
	}
}


function DataSources()
{
	this.connectors = [];


	if (mithril.config && mithril.config.data)
	{
		for (var name in mithril.config.data)
		{
			var config = mithril.config.data[name];
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
	if (mysql === null) mysql = require(mithril.paths.extlib + '/mysql');

	var client = new mysql.Client();
	client.user = config.user;
	client.password = config.pass;
	client.host = config.host;
	client.port = config.port;
	client.database = config.dbname;
	client.connect(function() { mithril.logger.info('Connected to MySQL server at ' + client.host + ':' + client.port); });
	return client;
}


function MySqlDatabase(config)
{
	this.config = config;
	this.inTransaction = false;
	this.connRW = null;
	this.connRO = null;
	this.transactionUnwrap = null;
	this.transactionError = null;
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


MySqlDatabase.prototype.source = function(readonly)
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

		this.source(false).query('START TRANSACTION', [], function(err) {
			if (err)
			{
				if (cb) cb(errors.DB_ERROR);
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

		this.source(false).query('COMMIT', [], function(err) {
			if (err)
			{
				if (cb) cb(errors.DB_ERROR);
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

		this.source(false).query('ROLLBACK', [], function(err) {
			if (err)
			{
				if (cb) cb(errors.DB_ERROR);
			}
			else
			{
				_this.inTransaction = false;
				if (cb) cb(null);
			}
		});
	}
};


MySqlDatabase.prototype.wrapTransaction = function(wrap, unwrap)
{
	this.transactionUnwrap = unwrap;
	this.transactionError = null;

	this.beginTransaction(function(error) {
		if (error)
		{
			unwrap(error);
			this.transactionUnwrap = null;
			this.transactionError = null;
		}
		else
			wrap(this);
	});
};


MySqlDatabase.prototype.unwrapTransaction = function()
{
	var error = this.transactionError;
	var unwrap = this.transactionUnwrap;

	this.transactionUnwrap = null;
	this.transactionError = null;

	if (error)
	{
		this.rollBack();
		unwrap(error);
	}
	else
	{
		this.commit(function(err) {
			if (err)
				unwrap(errors.DB_ERROR);
			else
				unwrap(null);
		});
	}
};


MySqlDatabase.prototype.getOne = function(sql, params, required, error, cb)
{
	if (this.transactionError)
	{
		cb(this.transactionError);
		return;
	}

	this.source(true).query(sql, params, function(err, results) {
		if (err || (required && results.length != 1) || results.length > 1)
		{
			this.transactionError = error;
			cb(error);
		}
		else
		{
			var result = (result.length > 0) ? result[0] : null;

			cb(null, result);
		}
	});
};


MySqlDatabase.prototype.getMany = function(sql, params, error, cb)
{
	if (this.transactionError)
	{
		cb(this.transactionError);
		return;
	}

	this.source(true).query(sql, params, function(err, results) {
		if (err)
		{
			this.transactionError = error;
			cb(error);
		}
		else
			cb(null, results);
	});
};


MySqlDatabase.prototype.exec = function(sql, params, error, cb)
{
	if (this.transactionError)
	{
		if (cb) cb(this.transactionError);
		return;
	}

	this.source(false).query(sql, params, function(err, info) {
		if (err)
		{
			this.transactionError = error;
			if (cb) cb(error);
		}
		else
		{
			if (cb) cb(null, info);
		}
	});
};


MySqlDatabase.prototype.buildSelect = function(fields, allowedFields, table, joins, params)
{
/* example:

var fields = ['actorName'];

var joins = {
                actorActor:  { sql: 'JOIN actor AS ? ON sns_friend.actor = ?.id' },
                friendActor: { sql: 'LEFT JOIN actor AS ? ON sns_friend.friend = ?.id', requires: ['actorActor'] }
}

var allowedFields = {
                actorId:            'actorId'
                actorName:          ['actorActor', 'name'],
                actorCreationTime:  ['actorActor', 'creationTime'],
                friendName:         ['friendActor', 'name'],
                friendCreationTime: ['friendActor', 'creationTime']
}
*/
	var requiredJoins = {};

	function addRequiredJoin(tableAlias)
	{
		if (tableAlias in requiredJoins) return;

		requiredJoins[tableAlias] = joins[tableAlias].sql.replace(/\?/g, tableAlias);

		var rule = joins[tableAlias];

		if ('requires' in rule)
		{
			for (var i=0; i < rule.requires.length; i++)
			{
				addRequiredJoin(rule.requires[i]);
			}
		}
	}

	var result = ['SELECT'];
	var resultFields = [];

	for (var i=0; i < fields.length; i++)
	{
		var fieldAlias = fields[i];
		var field = allowedFields[fieldAlias];

		if (typeof field == 'string')
		{
			if (field == fieldAlias)
				resultFields.push(field);
			else
				resultFields.push(field + ' AS ' + fieldAlias);
		}
		else
		{
			resultFields.push(field[0] + '.' + field[1] + ' AS ' + fieldAlias);

			addRequiredJoin(field[0]);
		}
	}

	result.push(resultFields.join(', '));
	result.push('FROM ' + table);

	for (var tableAlias in requiredJoins)
	{
		result.push(requiredJoins[tableAlias]);
	}

	return result.join(' ');
};



exports.DataSources = DataSources;

