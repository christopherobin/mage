exports.register = function () {
	var builders = require('../builders');

	var appInfoBuilder = require('./appInfoBuilder');
	var fileContentBuilder = require('./fileContentBuilder');
	var fileBuilder = require('./fileBuilder');
	var dirBuilder = require('./dirBuilder');
	var fileOrDirBuilder = require('./fileOrDirBuilder');
	var configDirBuilder = require('./configDirBuilder');

	builders.add('app', appInfoBuilder.build.bind(appInfoBuilder));
	builders.add('filecontent', fileContentBuilder.build.bind(fileContentBuilder));
	builders.add('file', fileBuilder.build.bind(fileBuilder));
	builders.add('dir', dirBuilder.build.bind(dirBuilder));
	builders.add('path', fileOrDirBuilder.build.bind(fileOrDirBuilder));
	builders.add('pathlist', fileOrDirBuilder.buildList.bind(fileOrDirBuilder));
	builders.add('config', configDirBuilder.build.bind(configDirBuilder));
};
