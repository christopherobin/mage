var mithril = require('../../mithril'),
    async = require('async');

var helpers = mithril.core.helpers;
var fileOrDirBuilder = require('./fileOrDirBuilder');


exports.build = function (buildTarget, language, contextName, dirPath, cb) {
	//   if contextName.buildlist exists:
	//     for each file mentioned in build list, run buildFileOrDirectory()
	//   else:
	//     for each file that matches this context, run buildFile()
	//     for each directory, run buildDirectory()

	helpers.getFileContents(dirPath + '/' + contextName + '.buildlist', { optional: true }, function (error, buildList) {
		// error is not relevant, this file does not have to exist

		var i, len;

		if (buildList) {
			// split and sanitize the build list

			var list = buildList.split('\n');

			buildList = [];
			for (i = 0, len = list.length; i < len; i++) {
				var file = list[i].trim();

				if (file.length > 0) {
					buildList.push(dirPath + '/' + file);
				}
			}

			return fileOrDirBuilder.buildList(buildTarget, language, contextName, buildList, cb);
		}

		// no build list was given, so we generate one based on the directory contents

		var context = mithril.core.app.contexts.get(contextName);
		if (!context) {
			mithril.core.logger.error('Context "', contextName, '" not defined.');
			return cb('noSuchContext');
		}

		var extensions = context.ext;

		var re = [];
		for (i = 0, len = extensions.length; i < len; i++) {
			re.push('(\\.' + extensions[i] + '$)');
		}

		var matcher = new RegExp(re.join('|'));

		// TODO: give readDirectory() the ability to use a function as a matcher, so regexps won't be needed

		helpers.readDirectory(dirPath, matcher, function (error, contents) {
			// returned: { files: [], directories: [] } containing relative paths

			if (error) {
				return cb(error);
			}

			// first files, then directories

			var buildList = contents.files.concat(contents.directories);

			for (var i = 0, len = buildList.length; i < len; i++) {
				buildList[i] = dirPath + '/' + buildList[i];
			}

			fileOrDirBuilder.buildList(buildTarget, language, contextName, buildList, cb);
		});
	});
};

