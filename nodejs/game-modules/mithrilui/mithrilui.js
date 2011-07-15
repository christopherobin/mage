//exports.viewport = require(__dirname + '/viewport.js');


var loaderPage = null;
var fs = require('fs');


exports.setup = function(state, cb)
{
	loaderPage = fs.readFileSync(__dirname + '/loader.html');


	mithril.addRoute(/^\/page\//, function(request, path, params, cb) {

		// requested path can be:
		// page
		//   eg: /page/game
		// package:
		//   eg: /page/game/landing

		path = path.substring(6).split('/').filter(function(elm) { return elm; });	// drop /page/
		if (!path || path.length == 0)
		{
			return cb(false);
		}

		switch (path.length)
		{
			case 1:
				// page, so we return the loader

				cb(200, loaderPage, { 'Content-Type': 'text/html; charset=utf8' });
				break;

			case 2:
				// a page's package

				var partSplit = params.partSplit;

				var dummy = 'text/html\n' + '<h1>' + path[1] + '</h1>' + partSplit + 'text/css\n' + 'body { background: red; }' + partSplit + 'text/javascript\n' + 'alert("awesome! ' + path[1] + '")';

				cb(200, dummy);
				break;
		}
	});

	cb();
};


