var MySqlDatabase = require(__dirname + '/datasource-mysql.js').MySqlDatabase;


function DataSources(state)
{
	this.connectors = [];


	if (mithril.core.config && mithril.core.config.data)
	{
		for (var name in mithril.core.config.data)
		{
			var config = mithril.core.config.data[name];
			var obj = null;

			switch (config.type)
			{
				case 'mysql': obj = new MySqlDatabase(state, config); break;
			}

			if (obj)
			{
				this[name] = obj;
				this.connectors.push({ name: name, obj: obj });
			}
		}
	}
}


DataSources.prototype.packProperty = function(value)
{
	var result = { type: typeof value };

	switch (result.type)
	{
		case 'object': result.value = JSON.stringify(value); break;
		case 'boolean': result.value = value ? '1' : '0'; break;
		default: result.value = value; break;
	}

	return result;
};


DataSources.prototype.unpackProperty = function(value, type)
{
	switch (type)
	{
		case 'object':
			try
			{
				value = JSON.parse(value);
			}
			catch (err)
			{
				mithril.core.logger.error('Could not unpack object from string', value);
				value = {};
			}
			break;

		case 'number':
			value = new Number(value);
			break;

		case 'boolean':
			value = (value == 'false' || value == '0') ? false : new Boolean(value);
			break;

		// string remains a string
	}

	return value;
};


DataSources.prototype.unpackObjectProperty = function(obj, valueName, typeName)
{
	obj[valueName] = this.unpackProperty(obj[valueName], obj[typeName]);
	delete obj[typeName];
};


DataSources.prototype.autoTransaction = function(rules)
{
	// rules: { write: true, read: false }

	var len = this.connectors.length;
	while (len--)
	{
		this.connectors[len].obj.autoTransaction(rules);
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

	var len = this.connectors.length;
	while (len--)
	{
		var conn = this.connectors[len];

		conn.obj.close();
		delete this[conn.name];
	}

	this.connectors = [];
};


exports.DataSources = DataSources;

