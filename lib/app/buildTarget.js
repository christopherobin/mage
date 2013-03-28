var mage = require('../mage'),
    logger = mage.core.logger,
    path = require('path'),
    async = require('async');



function BuildTarget(app, builderName, key, context, routes, options, allowPostProcessors) {
	this.app = app;
	this.builderName = builderName;
	this.key = key;
	this.context = context;
	this.routes = routes;
	this.options = options || {};
	this.allowPostProcessors = allowPostProcessors || false;
	this.rootPath = null;	// may be overridden by file builders
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


BuildTarget.prototype.build = function (clientConfig, cb) {
	// TODO: perhaps instead of using context.name, we should build by passing around context

	var fnBuild = require('./builders').get(this.builderName);

	var that = this;

	fnBuild(this, clientConfig, this.context.name, this.key, function (error, data, meta) {
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

