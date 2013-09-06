var mage = require('../../mage');
var logger = mage.core.logger;
var Builder = require('component-builder');
var async = require('async');
var pathJoin = require('path').join;


function buildMageConfig(buildTarget) {
	// We construct a mageConfig object from our app's config file. These are
	// the core app config bits that need to make it into the build. They will
	// only be added once per page.

	// They get injected into window.mageConfig by component builder.

	// The app's URL needs to be hard coded into the build so the game knows
	// which server to connect to.

	return {
		appName: buildTarget.app.name,
		appVariants: {
			languages: buildTarget.app.languages,
			densities: buildTarget.app.densities
		},
		clientHostBaseUrl: mage.core.msgServer.getClientHost().getClientHostBaseUrl(),
		savvyBaseUrl: mage.core.savvy.getBaseUrl(),
		userCommands: buildTarget.app.commandCenter.commands,
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
		var error = new Error('Unsupported context: ' + contextName);
		logger.emergency(error);
		return cb(error);
	}

	var indexPage = buildTarget.options.requiredBy;

	var requireNeeded = contextName === 'js';
	var configNeeded = contextName === 'js';
	var ignored = [];
	var buildList = [];

	// currentComponentPath is the actual component that we want. We may have
	// to build a bunch before we get to this one, but none after.

	var currentComponentPath;

	if (indexPage) {
		// We are a component that was registered with an indexPage. We need to
		// build the indexPage and every component on it up to us.

		// First the indexPage itself.

		buildList.push(indexPage.key);

		// and all components up to us.

		for (var i = 0; i < indexPage.components.length; i += 1) {
			var componentPath = indexPage.components[i];
			var componentName = buildTarget.app.getComponent(componentPath).key;

			buildList.push(componentPath);

			if (componentName === data) {
				currentComponentPath = componentPath;
				break;
			}
		}
	} else {
		// We are an indexPage so we just build ourself.
		var path = buildTarget.app.getComponent(data) ? buildTarget.app.getComponent(data).path : data;

		buildList.push(path);

		currentComponentPath = path;
	}

	var out = '';

	function buildComponent(componentPath, callback) {
		// component-builder, give it a path to the component you want to build.

		var builder;

		try {
			builder = new Builder(componentPath);
		} catch (error) {
			logger.emergency(error);
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

					logger.debug(depBuilder.basename, 'has files dependencies that were not copied, ' +
						'please manually create the symlinks if necessary.');
				}

				depBuilder.config.files = undefined;
			}

			// we need to apply that function recursively on dependencies
			depBuilder.on('dependency', disableAssets);
		}

		// run it
		disableAssets(builder);

		// sourceURLs ftw!
		builder.addSourceURLs();

		// Our default paths for components within MAGE. This may need to be
		// augmented in the future. We might consider figuring out a way to not
		// have to hardcode these.

		for (var i = 0; i < lookupPaths.length; i++) {
			builder.addLookup(lookupPaths[i]);
		}

		// apply our current ignore list to this run of the component builder.

		for (i = 0; i < ignored.length; i++) {
			builder.ignore(ignored[i]);
		}

		// Config event in component/builder is is where we inject our config
		// data.

		if (configNeeded) {

			// Only inject the config if we are building the component that
			// we actually want the output from.

			if (currentComponentPath === componentPath) {

				// We use append here to inject some text into our build.

				builder.append('window.mageConfig = ' + JSON.stringify(buildMageConfig(buildTarget)) + ';');
			}

			configNeeded = false;
		}

		// Emit an event so that users can attach plugins to the builder

		buildTarget.app.emit('build-component', builder, buildTarget);

		// Let builder do its magic

		builder.build(function (err, obj) {
			if (err) {
				logger.emergency('Component build error:', err);
				return callback(err);
			}

			// Only inject require boilerplate once per indexPage.

			if (requireNeeded) {
				// Only inject required if the component we are building is
				// the component we want the output from.

				if (currentComponentPath === componentPath) {
					out += obj.require;
				}

				requireNeeded = false;
			}

			// Add the components we have just built to the ignore list for
			// this component. So that we only inject a component once per
			// indexPage.

			ignored = ignored.concat(builder.ignored.files);

			// Only get inject the component that we actually want.

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
