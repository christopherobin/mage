var mage = require('../../mage');
var logger = mage.core.logger;
var helpers = mage.core.helpers;
var fileOrDirBuilder = require('./fileOrDirBuilder');


exports.build = function (buildTarget, clientConfig, contextName, dirPath, cb) {
	//   if contextName.buildlist exists:
	//     for each file mentioned in build list, run buildFileOrDirectory()
	//   else:
	//     for each file that matches this context, run buildFile()
	//     for each directory, run buildDirectory()

	if (!dirPath) {
		logger.error('Cannot open unspecified directory (skipping).');
		return cb(null, '');
	}

	dirPath = buildTarget.resolvePath(dirPath);

	// no build list was given, so we generate one based on the directory contents

	var context = mage.core.app.contexts.get(contextName);

	if (!context) {
		logger.error('Context "' + contextName + '" not defined.');
		return cb('noSuchContext');
	}

	var extensions = context.ext;
	var matcher = null;

	// build a matcher regexp, except when the asterisk is to be matched (any file matches)

	if (extensions.indexOf('*') === -1) {
		var re = ['(^' + contextName + '\\.buildlist$)'];

		for (var i = 0, len = extensions.length; i < len; i++) {
			re.push('(\\.' + extensions[i] + '$)');
		}

		matcher = new RegExp(re.join('|'));
	}

	// TODO: give readDirectory() the ability to use a function as a matcher, so regexps won't be needed

	helpers.readDirectory(dirPath, matcher, function (error, contents) {
		// returned: { files: [], directories: [] } containing relative paths

		if (error) {
			return cb(error);
		}

		if (contents.files.indexOf(contextName + '.buildlist') === -1) {
			// the build list is all files of the proper extensions in the directory

			// first files, then directories

			var buildList = contents.files.concat(contents.directories);

			for (var i = 0, len = buildList.length; i < len; i++) {
				buildList[i] = dirPath + '/' + buildList[i];
			}

			return fileOrDirBuilder.buildList(buildTarget, clientConfig, contextName, buildList, cb);
		}

		// use the build list file

		helpers.getFileContents(dirPath + '/' + contextName + '.buildlist', {}, function (error, buildList) {
			if (error) {
				return cb(error);
			}

			// split and sanitize the build list

			var list = buildList.split('\n');

			buildList = [];
			for (var i = 0, len = list.length; i < len; i++) {
				var file = list[i].trim();

				if (file.length) {
					buildList.push(dirPath + '/' + file);
				}
			}

			return fileOrDirBuilder.buildList(buildTarget, clientConfig, contextName, buildList, cb);
		});
	});
};

