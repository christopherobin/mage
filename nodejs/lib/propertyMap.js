function PropertyMap(serializedProperties)
{
	this.values = {};
	this.serializedProperties = serializedProperties || [];
};


PropertyMap.prototype.add = function(property, language, value)
{
	if (!language) language = 'default';

	if (!this.values[property]) this.values[property] = {};

	if (property in this.serializedProperties)
	{
		try
		{
			value = JSON.parse(value);
		}
		catch (err)
		{
			mithril.core.logger.error('Failed parsing value as JSON', value);
		}
	}

	this.values[property][language] = value;
};


PropertyMap.prototype.get = function(property, language)
{
	if (property in this.values)
	{
		var obj = this.values[property];

		if (!language) language = 'default';

		if (language in obj)
		{
			return obj[language];
		}
	}

	return null;
};


PropertyMap.prototype.getAll = function(language)
{
	var result = {};

	for (var property in this.values)
	{
		var obj = this.value;

		if (language in obj)
		{
			result[property] = obj[language];
		}

		if (obj.default)
		{
			result[property] = obj.default;
		}
	}
};

exports.PropertyMap = PropertyMap;

