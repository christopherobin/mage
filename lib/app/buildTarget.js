var mage = require('../mage');
var builders = require('./builders');
var logger = mage.core.logger;
var path = require('path');
var async = require('async');


function BuildTarget(app, builderName, key, context, routes, options, allowPostProcessors) {
	if (!context) {
		throw new Error('No context given while creating ' + key + ' BuildTarget (' + builderName + ')');
	}

	this.app = app;
	this.builderName = builderName;
	this.key = key;
	this.context = context;
	this.routes = routes;
	this.options = options || {};
	this.allowPostProcessors = allowPostProcessors || false;
	this.rootPath = null;	// may be overridden by file builders
	this.pageName = null;
	this.components = [];
}


exports.BuildTarget = BuildTarget;


BuildTarget.prototype.describe = function () {
	return this.builderName + ':' + this.key + ' (' + this.context.name + ')';
};


BuildTarget.prototype.resolvePath = function (relPath) {
	if (this.rootPath) {
		return path.resolve(this.rootPath, relPath);
	}

	return relPath;
};


BuildTarget.prototype.registerComponent = function (name, path, options) {
	if (this.components.indexOf(path) !== -1) {
		throw new Error('Component \'' + path + '\' was already registered on indexPage \'' + this.pageName + '\'');
	}

	this.components.push(path);

	this.app.registerComponent(name, path, this, options);
};


BuildTarget.prototype.applyPostProcessors = function (data, cb) {
	if (!this.allowPostProcessors) {
		return cb(null, data);
	}

	var ppNames;

	if (this.app.delivery.postprocessors) {
		ppNames = this.app.delivery.postprocessors[this.context.name];

		if (typeof ppNames === 'string') {
			ppNames = [ppNames];
		}
	}

	if (!ppNames || ppNames.length === 0) {
		return cb(null, data);
	}

	var context = this.context;

	async.forEachSeries(
		ppNames,
		function (ppName, callback) {
			var postProcessor = context.postProcessors[ppName];
			if (!postProcessor) {
				logger.error('Unknown postprocessor', ppName, 'for context', context.name);
				return callback('badPostProcessor');
			}

			postProcessor(data, function (error, newdata) {
				if (!error) {
					data = newdata;
				}

				callback(error);
			});
		},
		function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, data);
		}
	);
};


BuildTarget.prototype.getBuilder = function () {
	return builders.get(this.builderName);
};


BuildTarget.prototype.build = function (clientConfig, cb) {
	// TODO: perhaps instead of using context.name, we should build by passing around context

	var builder = this.getBuilder();
	var that = this;

	builder.build(this, clientConfig, this.context.name, this.key, function (error, data, meta) {
		if (error) {
			return cb(error);
		}

		that.applyPostProcessors(data, function (error, newdata) {
			if (error) {
				return cb(error);
			}

			cb(null, newdata, meta);
		});
	});
};

