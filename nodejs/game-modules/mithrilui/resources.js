exports.img   = require(__dirname + '/img.js');
exports.pages = require(__dirname + '/pages.js');


exports.getManifest = function(state, cb)
{
	var str = ['CACHE MANIFEST', '', 'CACHE:'];

	exports.img.getManifest(state, function(error, images) {
		if (error) return cb(error);

		images.sort();

		str = str.concat(images);

		str.push('', 'NETWORK:', '*');

		cb(null, str.join('\n'));
	});
};


exports.Domain = function(baseUrl) {
	return { baseUrl: baseUrl };
};


/*

// abilities:
// - serve a merged HTML/CSS/JavaScript set as a single page (required for loader/landingpage)
// - serve a bunch of chunks combined into one set (eg: loading 3 views at the same time)
// - templating (replace())
// - minification
// - gzip compression of all content
// - file last change time
// - manifest generation


exports.addTemplate = function(className, instances, availability)
{
	// availability: always (streamed during sync, default), ondemand (streamed on first use), rarely (ondemand, and should be removed from dom after use)

//	instances: { deck: null, deck2: 'xmas' }

	base.html
	base.js
	base.css

	// these augment base:

	xmas.css
	xmas.html
	halloween.css
	halloween.html
};

*/
