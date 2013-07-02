exports.register = function () {
	var builders = require('../builders');

	var appInfoBuilder = require('./appInfoBuilder');
	var fileContentBuilder = require('./fileContentBuilder');
	var fileBuilder = require('./fileBuilder');
	var dirBuilder = require('./dirBuilder');
	var fileOrDirBuilder = require('./fileOrDirBuilder');
	var cfgBuilder = require('./cfgBuilder');
	var componentBuilder = require('./componentBuilder');

	builders.add('app', appInfoBuilder);
	builders.add('filecontent', fileContentBuilder);
	builders.add('file', fileBuilder);
	builders.add('dir', dirBuilder);
	builders.add('path', fileOrDirBuilder);
	builders.add('pathlist', fileOrDirBuilder.buildList);
	builders.add('cfg', cfgBuilder);
	builders.add('component', componentBuilder);
};
