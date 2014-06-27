var async = require('async');
var crypto = require('crypto');
var mage = require('../../mage');
var builders = require('../builders');
var BuildTarget = require('../buildTarget').BuildTarget;
var contexts = require('../contexts');
var logger = mage.core.logger;

function buildManifest(buildTarget, clientConfig, context, cb) {
	logger.verbose
		.data(clientConfig)
		.log('Building manifest', buildTarget.describe());

	buildTarget.app.assetMap.reindex(function () {
		var manifest = buildTarget.app.getManifestBuildTarget();

		if (!manifest) {
			// no manifest set up
			logger.warning('No manifest exists for application', buildTarget.app.name);
			return cb(null, '');
		}

		if (context.name === 'url') {
			return cb(null, manifest.routes[0]);
		}

		if (context.name === 'manifest') {
			return cb(null, manifest.options.manifest.generate(clientConfig));
		}

		var errorContext = new Error('Manifest builder cannot deal with context ' + context.name);
		logger.error(errorContext);
		return cb(errorContext);
	});
}


function buildComponentPage(buildTarget, clientConfig, req, key, cb) {
	if (!clientConfig) {
		throw new ReferenceError('No clientConfig.');
	}

	logger.verbose
		.data(clientConfig)
		.log('Building component', buildTarget.describe());

	var app = buildTarget.app;
	var options = buildTarget.options;
	var contexts = mage.core.app.contexts;
	var pagePath = options.path;

	// Because we copy the buildTarget options straight into the sub targets, they will inherit
	// options.requiredBy which holds the indexPage that this component page will be required on.

	// The day we add HTML to our component builds, we should ideally drop the "html" context
	// build (would remove all directory scanning, and thus improve build-performance). In fact,
	// from that day on, we can remove a lot of builders and we could make component a single-pass
	// build-phase that would generate JS and CSS in one go (we currently build once for each).

	var subTargets = [];

	if (options.assetMap) {
		if (app.assetMap) {
			subTargets.push(new BuildTarget(app, 'assets', app.assetMap, contexts.get('assetmap'), [], options, true));
		} else {
			logger.warning('There is no asset map to include in buildTarget "assets".');
		}
	}

	subTargets.push(new BuildTarget(app, 'component', key, contexts.get('js'), [], options, true));
	subTargets.push(new BuildTarget(app, 'component', key, contexts.get('css'), [], options, true));
	subTargets.push(new BuildTarget(app, 'dir', pagePath, contexts.get('html'), [], options, true));

	var response = '';
	var delimiter = buildTarget.options.delimiter || '--package-part--';
	var fullMeta = {};

	function buildSubTargets(subTarget, callback) {
		subTarget.build(clientConfig, req, function (error, data, meta) {
			if (error) {
				return callback(error);
			}

			if (!data) {
				return callback();
			}

			if (response.length > 0) {
				response += delimiter;
			}

			var mimetype = subTarget.context.mimetype || 'text/plain';

			response += mimetype + '\n' + data;

			if (meta && meta.sourcemaps) {
				fullMeta.sourcemaps = fullMeta.sourcemaps || {};

				Object.keys(meta.sourcemaps).forEach(function (file) {
					fullMeta.sourcemaps[file] = meta.sourcemaps[file];
				});
			}

			return callback();
		});
	}

	async.forEachSeries(subTargets, buildSubTargets, function (error) {
		if (error) {
			return cb(error);
		}

		// calculate a hash on the response

		var hash = crypto.createHash('md5').update(response).digest('hex');

		var header = ['delimiter: ' + delimiter, 'hash: ' + hash];

		fullMeta.hash = hash;

		return cb(null, header.join('\n') + '\n\n' + response, fullMeta);
	});
}


function buildMagePage(buildTarget, clientConfig, req, cb) {
	logger.verbose
		.data(clientConfig)
		.log('Building page', buildTarget.describe());

	var app = buildTarget.app;
	var options = buildTarget.options;
	var contexts = mage.core.app.contexts;
	var pagePath = buildTarget.options.path;

	var subTargets = [];

	if (buildTarget.options.assetMap) {
		subTargets.push(new BuildTarget(
			buildTarget.app, 'assets', app.assetMap, contexts.get('assetmap'), [], options, true
		));
	}

	subTargets.push(new BuildTarget(app, 'dir', pagePath, contexts.get('html'), [], options, true));
	subTargets.push(new BuildTarget(app, 'dir', pagePath, contexts.get('css'),  [], options, true));
	subTargets.push(new BuildTarget(app, 'dir', pagePath, contexts.get('js'),   [], options, true));

	var response = '';
	var delimiter = buildTarget.options.delimiter || '--page-part--';

	function buildSubTargets(subTarget, callback) {
		subTarget.build(clientConfig, req, function (error, data) {
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

			return callback();
		});
	}

	async.forEachSeries(subTargets, buildSubTargets, function (error) {
		if (error) {
			return cb(error);
		}

		// calculate a hash on the response

		var hash = crypto.createHash('md5').update(response).digest('hex');

		var header = ['delimiter: ' + delimiter, 'hash: ' + hash];

		return cb(null, header.join('\n') + '\n\n' + response, { hash: hash });
	});
}


exports.build = function (buildTarget, clientConfig, req, contextName, key, cb) {
	// This function builds web stuff (magepage, manifest).
	// The given buildTarget is our current environment, which is indirectly responsible for this
	// function being called.

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
		return buildMagePage(buildTarget, clientConfig, req, cb);
	}

	if (contextName === 'component') {
		return buildComponentPage(buildTarget, clientConfig, req, key, cb);
	}

	if (key === 'manifest') {
		// key is irrelevant, there is only 1 manifest per app
		return buildManifest(buildTarget, clientConfig, context, cb);
	}

	logger.error('Web builder cannot deal with context', context.name);
	return cb('badContext');
};


builders.add('web', exports);

contexts.add('html', 'text/html; charset=UTF-8', '\n').addFileExtensions(['html', 'htm']);
contexts.add('css',  'text/css; charset=UTF-8', '\n').addFileExtensions(['css']);
contexts.add('js',   'text/javascript; charset=UTF-8', '\n').addFileExtensions(['js']);
contexts.add('xml',  'application/xml; charset=UTF-8', '\n').addFileExtensions(['xml']);

contexts.add('magepage',  'text/magepage; charset=UTF-8', '\n');
contexts.add('manifest',  'text/cache-manifest; charset=UTF-8', '\n');
contexts.add('component', 'text/component; charset=UTF-8', '\n');

contexts.add('url');
