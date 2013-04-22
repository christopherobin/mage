var mage = require('../../mage'),
    fs = require('fs');


var buildPaths = mage.core.app.builders.get('pathlist');
var buildDir = mage.core.app.builders.get('dir');


var srcPath = __dirname + '/src';


function buildCore(buildTarget, language, contextName, cb) {
	var paths = [
		srcPath + '/lib/eventEmitter.js',
		srcPath + '/mage.js'
	];

	buildPaths(buildTarget, language, contextName, paths, cb);
}


function buildLoader(buildTarget, language, contextName, cb) {
	var path = srcPath + '/loader';

	buildDir(buildTarget, language, contextName, path, cb);
}


function buildModuleSystem(buildTarget, language, contextName, cb) {
	var paths = [
		srcPath + '/lib/modules.js',
		srcPath + '/lib/helpers.js'
	];

	buildPaths(buildTarget, language, contextName, paths, cb);
}


function buildDataTypes(buildTarget, language, contextName, cb) {
	var paths = [
		srcPath + '/lib/data.js',
		srcPath + '/lib/datatypes/timedState.js',
		srcPath + '/lib/datatypes/timedValue.js',
		srcPath + '/lib/datatypes/timedNumber.js'
	];

	buildPaths(buildTarget, language, contextName, paths, cb);
}


function buildIo(buildTarget, language, contextName, cb) {
	var paths = [
		srcPath + '/lib/io.js',
		srcPath + '/lib/transports/http.js',
		srcPath + '/lib/transports/http-longpolling.js',
		srcPath + '/lib/transports/http-shortpolling.js'
	];

	buildPaths(buildTarget, language, contextName, paths, cb);
}


function buildPlugin(buildTarget, language, contextName, plugin, cb) {
	plugin = plugin.split('.');

	var mod = plugin.shift();

	plugin = plugin.join('.');

	mage.core.logger.verbose('Building plugin', plugin, 'from module', mod);

	var path = mage.getModulePath(mod);

	if (!path) {
		mage.core.logger.error('Module not found:', mod);
		return cb(null, '');
	}

	path += '/clientplugins/html5/' + plugin;

	fs.stat(path, function (error) {
		if (error) {
			mage.core.logger.error('Plugin', plugin, 'of module', mod, 'has no HTML5 client implementation in', path);
			return cb(error);
		}

		buildDir(buildTarget, language, contextName, path, cb);
	});
}


function buildModule(buildTarget, language, contextName, mod, cb) {
	mage.core.logger.verbose('Building module', mod);

	var path = mage.getModulePath(mod);

	if (!path) {
		mage.core.logger.error('Module not found:', mod);
		return cb(null, '');
	}

	path += '/clients/html5';

	fs.stat(path, function (error) {
		if (error) {
			mage.core.logger.error('Module', mod, 'has no HTML5 client implementation in', path);
			return cb(error);
		}

		buildDir(buildTarget, language, contextName, path, cb);
	});
}


function buildModuleConstructor(buildTarget, language, contextName, modName, cb) {
	mage.core.logger.verbose('Building module constructor for', modName);

	var commands = buildTarget.app.commandCenter.getModuleCommands(modName);

	var fn = [];

	for (var cmdName in commands) {
		var entry = commands[cmdName];

		if (!entry.mod.params) {
			continue;
		}

		var params = entry.mod.params;
		if (params) {
			var options = {};

			// copy access levels into options

			for (var key in entry.access) {
				options[key] = entry.access[key];
			}

			// function (cb) { io.send('shop.sync', {}, { hooks: ['session'], parallel: true }, cb); }

			var paramsPasser = [];

			for (var i = 0, len = params.length; i < len; i++) {
				var param = params[i];

				paramsPasser.push(param + ': ' + param);
			}

			var args = params.concat('cb');
			var paramsObj = '{ ' + paramsPasser.join(', ') + ' }';
			var optionsObj = JSON.stringify(options);
			var escName = JSON.stringify(cmdName);
			var evtSuccess = JSON.stringify('io.' + cmdName);

			fn.push('mod[' + escName + '] = function (' + args.join(', ') + ') {\n' +
				'\tvar params = ' + paramsObj + ';\n' +
				'\tio.send(' + JSON.stringify(entry.execPath) + ', params, ' + optionsObj + ', function (error, response) {\n' +
				'\t\tif (!error) {\n' +
				'\t\t\tmod.emit(' + evtSuccess + ', response, params);\n' +
				'\t\t}\n\n' +
				'\t\tif (cb) {\n' +
				'\t\t\tcb.apply(null, arguments);\n' +
				'\t\t}\n' +
				'\t});' +
				'};');
		}
	}

	function indent(n) {
		var result = '';

		while (n > 0) {
			result += '\t';
			n--;
		}

		return result;
	}

	var out = [];
	out.push(indent(0) + '{');
	out.push(indent(2) +   'name: \'' + modName + '\',');
	out.push(indent(2) +   'construct: function (io, mod) {');
	out.push(indent(3) +     fn.join('\n' + indent(3)));
	out.push(indent(2) +   '}');
	out.push(indent(1) + '}');

	cb(null, out.join('\n'));
}


exports.build = function (buildTarget, language, contextName, key, cb) {
	// buildTarget: the buildTarget environment for this build
	// language: language to build for
	// contextName: js/html/css/anything
	// key: the given subsystem to build

	if (key === 'loader') {
		return buildLoader(buildTarget, language, contextName, cb);
	}

	if (key === 'core') {
		return buildCore(buildTarget, language, contextName, cb);
	}

	if (key === 'modulesystem') {
		return buildModuleSystem(buildTarget, language, contextName, cb);
	}

	if (key === 'datatypes') {
		return buildDataTypes(buildTarget, language, contextName, cb);
	}

	if (key === 'io') {
		return buildIo(buildTarget, language, contextName, cb);
	}

	var splitKey = key.split('.');
	var first = splitKey.shift();

	if (first === 'module') {
		// module.actor

		var modName = splitKey.shift();
		var subOperation = splitKey.shift();

		if (subOperation) {
			if (subOperation === 'construct') {
				// module.actor.construct

				return buildModuleConstructor(buildTarget, language, contextName, modName, cb);
			}

			mage.core.logger.error('Cannot build HTML5 client module', modName, 'with unknown operation', subOperation);
			return cb('badOperation');
		}

		return buildModule(buildTarget, language, contextName, modName, cb);
	}

	if (first === 'plugin') {
		// plugin.assets.wizAssetsHandler

		var pluginName = splitKey.join('.');

		return buildPlugin(buildTarget, language, contextName, pluginName, cb);
	}

	mage.core.logger.error('Unknown render target for HTML5 client:', key);
	cb('badRenderTarget');
};


mage.core.app.builders.add('html5client', exports.build);

