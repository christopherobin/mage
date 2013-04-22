var mage = require('../../mage');
var logger = mage.core.logger;
var Builder = require('component-builder');
var async = require('async');

function buildMageConfig(buildTarget) {
	// We construct a mageConfig object from our app's config file. These are
	// the core app config bits that need to make it into the build. They will
	// only be added once per page.

	// They get injected into window.mageConfig by component builder.

	// The apps URL needs to be hard coded into the build so the game knows
	// which server to connect to.

	var out = {
		appName: buildTarget.app.name,
		appVariants: {
			languages: buildTarget.app.languages,
			densities: buildTarget.app.densities
		},
		clientHostBaseUrl: mage.core.msgServer.getClientHost().getExposedBaseUrl(),

		// pageName is the indexPage's name. Components that get added to this
		// indexPage need it so they can be built in the right order.
		pageName: buildTarget.options.pageName,
		userCommands: buildTarget.app.commandCenter.commands
	};

	return out;
}

exports.build = function (buildTarget, clientConfig, contextName, data, cb) {
	var requireAdded = false;
	var configAdded = false;
	var ignored = [];
	var buildList = [];

	// currentComponentPath is the actual component that we want. We may have
	// to build a bunch before we get to this one, but none after.

	var currentComponentPath;

	var indexPageName = clientConfig.pageName;

	if (indexPageName) {
		// We are a component that was registered with an indexPage. We need to
		// build the indexPage and every component on it up to us.

		var indexPage = buildTarget.app.getPage(indexPageName);

		// First the indexPage.

		buildList.push(indexPage.key);

		// and all components up to us.

		for (var i = 0; i < indexPage.components.length; i += 1) {
			var componentPath = indexPage.components[i];
			var componentName = buildTarget.app.getComponent(componentPath).componentName;

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
		// component-builder, give it a path to the component you want to
		// build.
		var builder = new Builder(componentPath);

		// sourceURLs ftw!
		builder.addSourceURLs();

		// Our default paths for components within MAGE. This may need to be
		// augmented in the future. We might consider figuring out a way to not
		// have to hardcode these.

		builder.addLookup('lib');
		builder.addLookup('lib/modules');
		builder.addLookup('node_modules');
		builder.addLookup('node_modules/mage/lib/modules');
		builder.addLookup('node_modules/mage/lib');
		builder.addLookup('node_modules/mage/node_modules');

		// apply our current ignore list to this run of the component builder.

		builder.ignore(ignored);

		// Config event in component/builder is is where we inject our config
		// data.

		builder.on('config', function () {
			// Only inject config once per indexPage.

			if (!configAdded) {

				// Only inject the config if we are building the component that
				// we actually want the output from.

				if (currentComponentPath === componentPath) {

					// We use append here to inject some text into our build.

					builder.append('window.mageConfig = ' + JSON.stringify(buildMageConfig(buildTarget)) + ';');
				}
				configAdded = true;
			}
		});

		builder.build(function (err, obj) {
			if (err) {
				logger.error(err);
				return callback(err);
			}

			// Only inject require boilerplate once per indexPage.

			if (!requireAdded) {
				// Only inject required if the component we are building is
				// the component we want the output from.

				if (currentComponentPath === componentPath) {
					out += obj.require;
				}
				requireAdded = true;
			}

			// Add the components we have just built to the ignore list for
			// this component. So that we only inject a component once per
			// indexPage.

			ignored = ignored.concat(builder.ignored.files);

			// Only get inject the component that we actually want.

			if (currentComponentPath === componentPath) {
				out += obj.js;
			}

			return callback(null, out);
		});
	}

	async.forEachSeries(buildList, buildComponent, function (error) {
		return cb(error, out);
	});
};
