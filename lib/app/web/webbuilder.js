var async = require('async'),
    fs = require('fs'),
    crypto = require('crypto'),
    mithril = require('../../mithril'),
	builders = require('../builders'),
    BuildTarget = require('../buildTarget').BuildTarget,
	contexts = require('../contexts');


function buildManifest(buildTarget, language, context, cb) {
	mithril.core.logger.info('Building manifest (' + context.name + '), for language', language);

	var manifest = buildTarget.app.getManifestBuildTarget();

	if (!manifest) {
		// no manifest set up
		mithril.core.logger.info('No manifest exists for application', buildTarget.app.name);

		return cb(null, '');
	}

	switch (context.name) {
	case 'url':
		return cb(null, manifest.routes[0]);
	case 'manifest':
		return cb(null, manifest.options.manifest.generate(language));
	}

	mithril.core.logger.error('Manifest builder cannot deal with context', context.name);
	cb('badContext');
}


function buildMithrilPage(buildTarget, language, context, cb) {
	mithril.core.logger.info('Building page', buildTarget.describe(), '(' + context.name + '), for language', language);

	var contexts = mithril.core.app.contexts;
	var pagePath = buildTarget.options.path;

	var subTargets = [];

	if (buildTarget.options.assetmap) {
		subTargets.push(new BuildTarget(buildTarget.app, 'assets', buildTarget.describe() + '.assetmap', contexts.get('assetmap'), [], {}, true));
	}

	subTargets.push(new BuildTarget(buildTarget.app, 'dir', pagePath, contexts.get('html'), [], null, true));
	subTargets.push(new BuildTarget(buildTarget.app, 'dir', pagePath, contexts.get('css'),  [], null, true));
	subTargets.push(new BuildTarget(buildTarget.app, 'dir', pagePath, contexts.get('js'),   [], null, true));

	var response = '';
	var delimiter = buildTarget.options.delimiter || '--page-part--';

	async.forEachSeries(
		subTargets,
		function (subTarget, callback) {
			subTarget.build(language, function (error, data) {
				if (error) {
					return callback(error);
				}

				if (response.length > 0) {
					response += delimiter;
				}

				var mimetype = subTarget.context.mimetype ? subTarget.context.mimetype : 'text/plain';

				response += mimetype + '\n' + data;

				callback();
			});
		},
		function (error) {
			if (error) {
				return cb(error);
			}

			// calculate a hash on the response

			var hash = crypto.createHash('md5').update(response).digest('hex');

			var header = ['delimiter: ' + delimiter, 'hash: ' + hash];

			cb(null, header.join('\n') + '\n\n' + response, { hash: hash });
		}
	);
}


exports.build = function (buildTarget, language, contextName, key, cb) {
	// this function builds web stuff (mithrilpage, manifest)
	// given buildTarget is our current environment, which is indirectly responsible for this function being called.

	// context information

	var context = mithril.core.app.contexts.get(contextName);

	if (!context) {
		mithril.core.logger.error('Unrecognized context:', contextName);
		return cb('badContext');
	}

	// if context is mithrilpage, we should do up to 4 builds and combine them: assetmap, html, css, javascript
	// if key is manifest, we build manifest output

	if (contextName === 'mithrilpage') {
		// key is the page name, which should correspond with buildTarget, so we can safely ignore it
		buildMithrilPage(buildTarget, language, context, cb);
	} else if (key === 'manifest') {
		// key is irrelevant, there is only 1 manifest per app
		buildManifest(buildTarget, language, context, cb);
	} else {
		mithril.core.logger.error('Web builder cannot deal with context', context.name);
		cb('badContext');
	}
};


builders.add('web', exports.build.bind(exports));

contexts.add('html', 'text/html; charset=utf8', '\n').addFileExtensions(['html', 'htm']);
contexts.add('css',  'text/css; charset=utf8', '\n').addFileExtensions(['css']);
contexts.add('js',   'text/javascript; charset=utf8', '\n').addFileExtensions(['js']);
contexts.add('mithrilpage', 'text/mithrilpage; charset=utf8', '\n');
contexts.add('manifest', 'text/cache-manifest; charset=utf8', '\n');
contexts.add('url');

