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

	var out = '';

	function buildComponent(entry, callback) {
		var componentPath = entry.path;
		var buildTarget = entry.buildTarget;

		// component-builder, give it a path to the component you want to build.

		var builder;

		try {
			builder = new Builder(componentPath);
		} catch (error) {
			return callback(error);
		}

		// disable any kind of asset/file copying shanenigans
		var assetsDisabled = [];

		function disableAssets(depBuilder) {
			// only run stuff if the config does have files
			if (depBuilder.config.files) {
				// only warn once, we don't need to flood the console
				if (assetsDisabled.indexOf(depBuilder.basename) === -1) {
					assetsDisabled.push(depBuilder.basename);

					logger.debug.data(depBuilder.config.files).log(depBuilder.basename,
						'has "files" dependencies that cannot be built. Please manually create ' +
						'symlinks or copies in an assets folder if needed.');
				}

				depBuilder.config.files = undefined;
			}

			// we need to apply that function recursively on dependencies
			depBuilder.on('dependency', disableAssets);
		}

		// run it
		disableAssets(builder);

		// Our default paths for components within MAGE. This may need to be
		// augmented in the future. We might consider figuring out a way to not
		// have to hardcode these.

		for (var i = 0; i < lookupPaths.length; i++) {
			builder.addLookup(lookupPaths[i]);
		}

		if (contextName === 'js') {
			// sourceURLs ftw!

			builder.addSourceURLs();

			// apply our current ignore list to this run of the component builder

			builder.ignore(ignoreList, 'scripts');

			// Only inject the config if we are building the target component

			if (currentComponentPath === componentPath) {
				builder.append('window.mageConfig = ' + JSON.stringify(buildMageConfig(app)) + ';');
			}
		}

		// Emit an event so that users can attach plugins to the builder

		app.emit('build-component', builder, buildTarget);

		// Let builder do its magic

		builder.build(function (err, obj) {
			if (err) {
				return callback(err);
			}

			// Only inject require boilerplate once per indexPage, and if the component we are
			// building is the target component.

			if (requireNeeded && currentComponentPath === componentPath) {
				out += obj.require;

				requireNeeded = false;
			}

			// Add the components we have just built to the ignore list for
			// this component. So that we only inject a component once per
			// indexPage.

			buildTarget.ignoreCache = builder.ignored.files || [];

			ignoreList = ignoreList.concat(builder.ignored.files);

			// Only inject the component that we actually want.

			if (currentComponentPath === componentPath) {
				out += obj[contextName];
			}

			return callback(null, out);
		});
	}

	async.forEachSeries(buildList, buildComponent, function (error) {
		return cb(error, out);
	});
};
