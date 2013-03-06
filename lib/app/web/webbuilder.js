var async = require('async'),
    crypto = require('crypto'),
    mage = require('../../mage'),
    builders = require('../builders'),
    BuildTarget = require('../buildTarget').BuildTarget,
    contexts = require('../contexts'),
    logger = mage.core.logger;


function buildManifest(buildTarget, clientConfig, context, cb) {
	logger.verbose
		.data(clientConfig)
		.log('Building manifest (' + context.name + ')');

	var manifest = buildTarget.app.getManifestBuildTarget();

	if (!manifest) {
		// no manifest set up
		logger.warning('No manifest exists for application', buildTarget.app.name);

		return cb(null, '');
	}

	switch (context.name) {
	case 'url':
		return cb(null, manifest.routes[0]);
	case 'manifest':
		return cb(null, manifest.options.manifest.generate(clientConfig));
	}

	logger.error('Manifest builder cannot deal with context', context.name);
	cb('badContext');
}


function buildComponent(buildTarget, clientConfig, context, key, cb) {
	if (!clientConfig) {
		throw new ReferenceError('No clientConfig');
	}

	logger.verbose
		.data(clientConfig)
		.log('Building component', buildTarget.describe());

	var contexts = mage.core.app.contexts;
	var pagePath = buildTarget.options.path;

	var subTargets = [];


	subTargets.push(new BuildTarget(buildTarget.app, 'component', key, contexts.get('js'), [], buildTarget.options, true));
	subTargets.push(new BuildTarget(buildTarget.app, 'dir', pagePath, contexts.get('css'), [], buildTarget.options, true));
	subTargets.push(new BuildTarget(buildTarget.app, 'dir', pagePath, contexts.get('html'), [], buildTarget.options, true));

	var response = '';
	var delimiter = buildTarget.options.delimiter || '--page-part--';

	async.forEachSeries(
		subTargets,
		function (subTarget, callback) {
			subTarget.build(clientConfig, function (error, data) {
				if (error) {
					return callback(error);
				}

				if (data) {
					if (response.length > 0) {
						response += delimiter;
					}

					var mimetype = subTarget.context.mimetype ? subTarget.context.mimetype : 'text/plain';

					response += mimetype + '\n' + data;
				}

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


function buildMagePage(buildTarget, clientConfig, context, cb) {
	logger.verbose
		.data(clientConfig)
		.log('Building page', buildTarget.describe());

	var contexts = mage.core.app.contexts;
	var pagePath = buildTarget.options.path;

	var subTargets = [];

	if (buildTarget.options.assetMap) {
		subTargets.push(new BuildTarget(buildTarget.app, 'assets', buildTarget.app.assetMap, contexts.get('assetmap'), [], buildTarget.options, true));
	}

	subTargets.push(new BuildTarget(buildTarget.app, 'dir', pagePath, contexts.get('html'), [], buildTarget.options, true));
	subTargets.push(new BuildTarget(buildTarget.app, 'dir', pagePath, contexts.get('css'),  [], buildTarget.options, true));
	subTargets.push(new BuildTarget(buildTarget.app, 'dir', pagePath, contexts.get('js'),   [], buildTarget.options, true));

	var response = '';
	var delimiter = buildTarget.options.delimiter || '--page-part--';

	async.forEachSeries(
		subTargets,
		function (subTarget, callback) {
			subTarget.build(clientConfig, function (error, data) {
				if (error) {
					return callback(error);
				}

				if (data) {
					if (response.length > 0) {
						response += delimiter;
					}

					var mimetype = subTarget.context.mimetype ? subTarget.context.mimetype : 'text/plain';

					response += mimetype + '\n' + data;
				}

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


exports.build = function (buildTarget, clientConfig, contextName, key, cb) {
	// this function builds web stuff (magepage, manifest)
	// given buildTarget is our current environment, which is indirectly responsible for this function being called.

	if (!clientConfig) {
		throw new ReferenceError('clientConfig missing.');
	}

	// context information
	var context = mage.core.app.contexts.get(contextName);

	if (!context) {
		logger.error('Unrecognized context:', contextName);
		return cb('badContext');
	}

	// if context is magepage, we should do up to 4 builds and combine them: assetmap, html, css, javascript
	// if key is manifest, we build manifest output

	if (contextName === 'magepage') {
		// key is the page name, which should correspond with buildTarget, so we can safely ignore it
		buildMagePage(buildTarget, clientConfig, context, cb);
	} else if (contextName === 'component') {
		buildComponent(buildTarget, clientConfig, context, key, cb);
	} else if (key === 'manifest') {
		// key is irrelevant, there is only 1 manifest per app
		buildManifest(buildTarget, clientConfig, context, cb);
	} else {
		logger.error('Web builder cannot deal with context', context.name);
		cb('badContext');
	}
};


builders.add('web', exports.build.bind(exports));

contexts.add('html', 'text/html; charset=utf8', '\n').addFileExtensions(['html', 'htm']);
contexts.add('css',  'text/css; charset=utf8', '\n').addFileExtensions(['css']);
contexts.add('js',   'text/javascript; charset=utf8', '\n').addFileExtensions(['js']);

contexts.add('magepage',  'text/magepage; charset=utf8', '\n');
contexts.add('manifest',  'text/cache-manifest; charset=utf8', '\n');
contexts.add('component', 'text/component; charset=utf8', '\n');

contexts.add('url');

