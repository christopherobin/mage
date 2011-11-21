var mithril = require('../../mithril'),
    fs = require('fs');


var buildPaths = mithril.core.app.builders.get('pathlist');
var buildDir = mithril.core.app.builders.get('dir');


var srcPath = __dirname + '/src';


function buildLoader(page, language, contextName, cb) {
	var path = srcPath + '/loader';

	buildDir(page, language, contextName, path, cb);
}


function buildCore(page, language, contextName, cb) {
	var paths = [
		srcPath + '/mithril.js',
		srcPath + '/lib/helpers.js',
		srcPath + '/lib/eventEmitter.js',
		srcPath + '/lib/datatypes.js',
		srcPath + '/lib/datatypes/timedValue.js',
		srcPath + '/lib/datatypes/timedNumber.js'
	];

	buildPaths(page, language, contextName, paths, cb);
}


function buildIo(page, language, contextName, cb) {
	var paths = [
		srcPath + '/lib/io.js',
		srcPath + '/lib/transports/http.js',
		srcPath + '/lib/transports/http-longpolling.js',
		srcPath + '/lib/transports/http-shortpolling.js'
	];

	buildPaths(page, language, contextName, paths, cb);
}


function buildPlugin(page, language, contextName, plugin, cb) {
	plugin = plugin.split('.');

	var mod = plugin.shift();

	plugin = plugin.join('.');

	mithril.core.logger.debug('Building plugin', plugin, 'from module', mod);

	var path = mithril.getModulePath(mod);

	if (!path) {
		mithril.core.logger.error('Module not found:', mod);
		return cb(null, '');
	}

	path += '/clientplugins/html5/' + plugin;

	fs.stat(path, function (error, stats) {
		if (error) {
			mithril.core.logger.error('Plugin', plugin, 'of module', mod, 'has no HTML5 client implementation in', path);
			return cb(error);
		}

		buildDir(page, language, contextName, path, cb);
	});
}


function buildModule(page, language, contextName, mod, cb) {
	mithril.core.logger.debug('Building module', mod);

	var path = mithril.getModulePath(mod);

	if (!path) {
		mithril.core.logger.error('Module not found:', mod);
		return cb(null, '');
	}

	path += '/clients/html5';

	fs.stat(path, function (error, stats) {
		if (error) {
			mithril.core.logger.error('Module', mod, 'has no HTML5 client implementation in', path);
			return cb(error);
		}

		buildDir(page, language, contextName, path, cb);
	});
}


exports.build = function (page, language, contextName, key, cb) {
	// page: the page environment for this build
	// language: language to build for
	// contextName: js/html/css/anything
	// key: the given subsystem to build

	if (key === 'loader') {
		return buildLoader(page, language, contextName, cb);
	}

	if (key === 'core') {
		return buildCore(page, language, contextName, cb);
	}

	if (key === 'io') {
		return buildIo(page, language, contextName, cb);
	}

	var splitKey = key.split('.');
	var first = splitKey.shift();

	if (first === 'module') {
		return buildModule(page, language, contextName, splitKey.join('.'), cb);
	}

	if (first === 'plugin') {
		return buildPlugin(page, language, contextName, splitKey.join('.'), cb);
	}

	mithril.core.logger.error('Unknown render target for HTML5 client:', key);
	cb('badRenderTarget');
};

