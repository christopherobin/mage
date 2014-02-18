var mage = require('../../../mage');
var fs = require('fs');
var path = require('path');
var marked = require('marked');
var hljs = require('highlight.js');

exports.access = 'admin';

exports.params = ['relPath'];


exports.execute = function (state, relPath, cb) {
	var absPath = path.join(mage.rootPackage.path, relPath);

	fs.readFile(absPath, function (error, data) {
		if (error) {
			return state.error(null, error, cb);
		}

		var options = {
			gfm: true,
			breaks: false,
			highlight: function (code, lang) {
				if (!code || !lang) {
					return code;
				}

				if (!hljs.getLanguage(lang)) {
					return code;
				}

				try {
					return hljs.highlight(lang, code).value || code;
				} catch (error) {
					mage.core.logger.warning('Error while trying to highlight in "' + lang + '":', error);
					return code;
				}
			}
		};

		var rendered = marked(data.toString(), options);

		state.respond(rendered);

		cb();
	});
};