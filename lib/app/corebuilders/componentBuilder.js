var mage = require('../../mage');
var logger = mage.core.logger.context('component');
var Builder = require('component-builder');
var async = require('async');
var pathJoin = require('path').join;


function buildMageConfig(app) {
	// We construct a mageConfig object from our app's config file. These are
	// the core app config bits that need to make it into the build. They will
	// only be added once per page.

	// They get injected into window.mageConfig by component builder.

	// The app's URL needs to be hard coded into the build so the game knows
	// which server to connect to.

	var clientHost = mage.core.msgServer.getClientHost();

	return {
		appName: app.name,
		appVariants: {
			languages: app.languages,
			densities: app.densities
		},
		cors: clientHost.getCorsConfig(),
		clientHostBaseUrl: clientHost.getClientHostBaseUrl(),
		savvyBaseUrl: mage.core.savvy.getBaseUrl(),
		userCommands: app.commandCenter.commands,
		developmentMode: mage.isDevelopmentMode()
	};
}


var lookupPaths = [pathJoin(process.cwd(), 'components')];

exports.addLookupPath = function (path) {
	if (lookupPaths.indexOf(path) !== -1) {
		logger.warning('Lookup path', path, 'was already registered. Ignoring.');
		return;
	}

	lookupPaths.push(path);
};


function compressAliases(aliases) {
	if (typeof aliases !== 'string') {
		return;
	}

	aliases = aliases.split('\n').sort();

	var unique = [aliases[0]];

	for (var i = 1; i < aliases.length; i += 1) {
		if (aliases[i] !== aliases[i - 1]) {
			unique.push(aliases[i]);
		}
	}

	return unique.join('\n');
}



exports.build = function (buildTarget, clientConfig, contextName, data, cb) {
	if (contextName !== 'js' && contextName !== 'css') {
		return cb(new Error('Unsupported context: ' + contextName));
	}

	logger.debug('Building', buildTarget.key, 'for', contextName);

	var app = buildTarget.app;
	var parentIndexPage = buildTarget.options.requiredBy;

	var requireNeeded = contextName === 'js';
	var useIgnoreList = contextName === 'js';
	var ignoreList = [];
	var buildList = [];

	// currentComponentPath is the actual component that we want. We may have to build a bunch
	// before we get to this one, but none after.

	var currentComponentPath;

	if (!parentIndexPage) {
		// We are an indexPage, so we just build ourself without regard for ignore lists.

		var path = app.getComponent(data) ? app.getComponent(data).path : data;

		buildList.push({ path: path, buildTarget: buildTarget });

		currentComponentPath = path;
	} else {
		// We are a component that was registered with an indexPage. We need to get the ignore lists
		// out of the indexPage and every component on it all the way up to us.

		requireNeeded = false;

		// First the indexPage itself.

		if (parentIndexPage.ignoreCache) {
			// make sure we ignore the components that were embedded in the index page

			if (useIgnoreList) {
				ignoreList = ignoreList.concat(parentIndexPage.ignoreCache);

				logger.verbose.data('files', parentIndexPage.ignoreCache).log('Ignoring prerequisite', parentIndexPage.key);
			}
		} else {
			// we don't know the components embedded in indexPage, so we need to build

			buildList.push({ path: parentIndexPage.key, buildTarget: parentIndexPage });

			logger.verbose('Queueing prerequisite build:', parentIndexPage.key);
		}

		// Then all components up to us.

		for (var i = 0; i < parentIndexPage.components.length; i += 1) {
			var componentPath = parentIndexPage.components[i];
			var component = app.getComponent(componentPath);
			var componentName = component.key;

			if (componentName === data) {
				// this is the page we actually want to build

				buildList.push({ path: componentPath, buildTarget: component });
				currentComponentPath = componentPath;

				logger.verbose('Queueing target component build:', componentPath);
			} else if (!currentComponentPath) {
				// this is a prerequisite page

				if (component.ignoreCache) {
					// it has been built before, so let's use its ignore list

					if (useIgnoreList) {
						ignoreList = ignoreList.concat(component.ignoreCache);

						logger.verbose.data('files', component.ignoreCache).log('Ignoring prerequisite', componentPath);
					}
				} else {
					// this is a prerequisite that has not been built yet

					buildList.push({ path: componentPath, buildTarget: component });

					logger.verbose('Queueing prerequisite build:', componentPath);
				}
			} else if (component.ignoreCache && useIgnoreList) {
				// kill cache of pages we may have influenced by being built

				component.ignoreCache = null;

				logger.verbose('Destroying ignore-cache of dependent:', componentPath);
			}
		}
	}

	/**
	 * The output of this build
	 *
	 * @type {string}
	 */

	var out = '';
	var sourcemaps = {};


	/**
	 * This function builds the scripts for a component
	 *
	 * @param {component.Builder} builder
	 * @param {boolean}           isTarget     Whether this instance of Builder is what we are actually looking for
	 * @param {BuildTarget}       buildTarget
	 * @param {Function}          callback
	 */

	function buildScripts(builder, isTarget, buildTarget, callback) {
		// sourceURLs ftw!

		if (isTarget) {
			builder.addSourceURLs();
		}

		// apply our current ignore list to this run of the component builder

		builder.ignore(ignoreList, 'scripts');

		// Only inject the config if we are building the target component

		builder.buildScripts(function (error, script) {
			if (error) {
				return callback(error);
			}

			// Add the components we have just built to the ignore list for
			// this component. So that we only inject a component once per
			// indexPage.

			buildTarget.ignoreCache = builder.ignored.scripts || [];

			ignoreList = ignoreList.concat(builder.ignored.scripts);

			// If we're not the target of the output, we are done after collecting the ignorelist.
			// Also, if for any weird reason there is no output, we're done here.

			if (!isTarget || !script) {
				return callback();
			}

			// check for sourcemaps (exposed on the builder when component-uglifyjs is used)

			if (builder.sourcemaps) {
				Object.keys(builder.sourcemaps).forEach(function (path) {
					sourcemaps[path] = builder.sourcemaps[path];
				});
			}

			builder.buildAliases(function (error, aliases) {
				if (error) {
					return callback(error);
				}

				var result = [];

				result.push('window.mageConfig = ' + JSON.stringify(buildMageConfig(app)) + ';');

				if (requireNeeded) {
					result.push(require('component-require'));

					requireNeeded = false;
				}

				result.push(script);

				// hack aliases into something smaller, due to https://github.com/component/builder.js/issues/117

				aliases = compressAliases(aliases);

				if (aliases) {
					result.push(aliases);
				}

				// write out the result

				out += result.join('\n');

				callback();
			});
		});
	}

	/**
	 * This function builds the styles for a component
	 *
	 * @param {component.Builder} builder
	 * @param {boolean}           isTarget  Whether this instance of Builder is what we are actually looking for
	 * @param {Function}          callback
	 */

	function buildStyles(builder, isTarget, callback) {
		if (!isTarget) {
			return callback();
		}

		builder.buildStyles(function (error, styles) {
			if (error) {
				return callback(error);
			}

			out += styles;

			callback();
		});
	}

	async.forEachSeries(
		buildList,
		function (entry, callback) {
			var isTarget = (entry.path === currentComponentPath);
			var builder;

			try {
				builder = new Builder(entry.path);
			} catch (error) {
				return callback(error);
			}

			// Add known fixed locations of components

			for (var i = 0; i < lookupPaths.length; i++) {
				builder.addLookup(lookupPaths[i]);
			}

			app.emit('build-component', builder, entry.buildTarget);

			if (contextName === 'js') {
				buildScripts(builder, isTarget, entry.buildTarget, callback);
			} else {
				buildStyles(builder, isTarget, callback);
			}
		},
		function (error) {
			cb(error, out, { sourcemaps: sourcemaps });
		}
	);
};
