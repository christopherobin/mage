var mithril = require('../mithril'),
    async = require('async'),
    MySqlDatabase = require('./mysql').MySqlDatabase;


function DataSources(state)
{
	this.connectors = [];


	if (mithril.core.config)
	{
		var data = mithril.core.config.data;
		if (data)
		{
			for (var name in data)
			{
				var dsConfig = data[name];
				var obj;

				switch (dsConfig.type)
				{
					case 'mysql': obj = new MySqlDatabase(state, dsConfig); break;
				}

				if (obj)
				{
					this[name] = obj;
					this.connectors.push({ name: name, obj: obj });
				}
			}
		}
	}
}


DataSources.prototype.autoTransaction = function(rules)
{
	// rules: { write: true, read: false }

	for (var i=0, len = this.connectors.length; i < len; i++)
	{
		this.connectors[i].obj.autoTransaction(rules);
	}
};


DataSources.prototype.commit = function(cb)
{
	async.forEach(
		this.connectors,
		function(conn, callback) { conn.obj.commit(callback); },
		function(error) { cb(); }
	);
};


DataSources.prototype.rollBack = function(cb)
{
	async.forEach(
		this.connectors,
		function(conn, callback) { conn.obj.rollBack(callback); },
		function(error) { cb(); }
	);
};


DataSources.prototype.close = function()
{
	// close any existing connections on this Data collection

	for (var i=0, len = this.connectors.length; i < len; i++)
	{
		var conn = this.connectors[i];

		conn.obj.close();
		delete this[conn.name];
	}

	this.connectors = [];
};


exports.DataSources = DataSources;

