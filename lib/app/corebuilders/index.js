exports.register = function () {
	var builders = require('../builders');

	var fileContentBuilder = require('./fileContentBuilder');
	var fileBuilder = require('./fileBuilder');
	var dirBuilder = require('./dirBuilder');
	var fileOrDirBuilder = require('./fileOrDirBuilder');

	builders.add('filecontent', fileContentBuilder.build.bind(fileContentBuilder));
	builders.add('file', fileBuilder.build.bind(fileBuilder));
	builders.add('dir', dirBuilder.build.bind(dirBuilder));
	builders.add('path', fileOrDirBuilder.build.bind(fileOrDirBuilder));
	builders.add('pathlist', fileOrDirBuilder.buildList.bind(fileOrDirBuilder));
};

