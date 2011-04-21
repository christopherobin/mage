var stream = require('stream');
var util = require('util');

exports.add = function(name, output)
{
	exports[name] = function(obj)
	{
		if (output instanceof stream.Stream)
		{
			output.write((typeof obj == 'string' ? obj : util.inspect(obj)) + '\n', 'utf8');
		}
		else
		{
			switch (output)
			{
				case 'stdout': console.log(obj); break;
				case 'stderr': console.error(obj); break;
			}
		}
	};
}

