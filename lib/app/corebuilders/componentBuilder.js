var mage = require('../../mage');
var logger = mage.core.logger;
var Builder = require('component-builder');
var async = require('async');

function buildMageConfig(buildTarget) {
	var clientHostBaseUrl = {
		protocol: 'http',
		host: mage.core.config.get('server.clientHost.expose.host') || 'localhost',
		port: mage.core.config.get('server.clientHost.expose.port') || 80,
		authUser: mage.core.config.get('server.clientHost.expose.authUser'),
		authPass: mage.core.config.get('server.clientHost.expose.authPass')
	};
	var out = {
		appName: buildTarget.app.name,
		appVariants: {
			languages: buildTarget.app.languages,
			densities: buildTarget.app.densities
		},
		clientHostBaseUrl: clientHostBaseUrl,
		pageName: buildTarget.options.pageName
	};
	return out;
}

exports.build = function (buildTarget, clientConfig, contextName, data, cb) {
	var indexPageName = clientConfig.pageName;

	var requireAdded = false;
	var configAdded = false;
	var ignored = [];
	var buildList = [];
	var currentComponent;

	if (indexPageName) {
		var indexPage = buildTarget.app.getPage(indexPageName);

		buildList.push(indexPage.key);

		for (var i = 0, len = indexPage.components.length; i < len; i += 1) {
			var componentName = indexPage.components[i];
			var componentPath = buildTarget.app.getComponent(componentName).path;
			buildList.push(componentPath);
			if (componentName === data) {
				currentComponent = componentPath;
				break;
			}
		}
	} else {
		var path = buildTarget.app.getComponent(data) ? buildTarget.app.getComponent(data).path : data;
		buildList.push(path);
		currentComponent = path;
	}

	var out = '';

	async.forEachSeries(buildList, function (componentPath, callback) {
		var builder = new Builder(componentPath);
		builder.addSourceURLs();

		builder.addLookup('node_modules');
		builder.addLookup('node_modules/mage/lib');

		for (var i = 0, len = ignored.length; i < len; i += 1) {
			builder.ignore(ignored[i]);
		}

		builder.on('config', function () {
			if (!configAdded) {
				var mageConfig = buildMageConfig(buildTarget);
				if (currentComponent === componentPath) {
					builder.append('window.mageConfig = ' + JSON.stringify(mageConfig) + ';');
				}
				configAdded = true;
			}
		});

		builder.build(function (err, obj) {
			if (err) {
				logger.error(err);
				return callback(err);
			}

			if (!requireAdded) {
				if (currentComponent === componentPath) {
					out += obj.require;
				}
				requireAdded = true;
			}

			ignored = ignored.concat(builder.ignored.files);

			if (currentComponent === componentPath) {
				out += obj.js;
			}

			callback(err, out);
		});
	}, function (error) {
		cb(error, out);
	});
};
