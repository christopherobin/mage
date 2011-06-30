var stream = require('stream');
//var util = require('util'); util.inspect() is nice, but doesn't go deep into objects

exports.add = function(name, output)
{
	exports[name] = function()
	{
		if (output instanceof stream.Stream)
		{
			var out = [];
			var len = arguments.length;

			for (var i=0; i < len; i++)
			{
				var obj = arguments[i];
				out.push(typeof obj == 'string' ? obj : JSON.stringify(obj));
			}

			var time = new Date;

			output.write(time.toJSON() + ' : ' + out.join(' ') + '\n', 'utf8');
		}
		else
		{
			switch (output)
			{
				case 'stdout': console.log.apply(this, arguments); break;
				case 'stderr': console.error.apply(this, arguments); break;
			}
		}
	};
}

