var mage = require('../../../mage');
var fs = require('fs');
var path = require('path');
var marked = require('marked');

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
			breaks: true,
			highlight: function (code, lang) {
				if (!code || !lang) {
					return code;
				}

				var hljs = require('highlight.js');

				try {
					return hljs.highlight(lang, code).value || code;
				} catch (error) {
					// probably an unsupported language issue
					return code;
				}
			}
		};

		var rendered = marked(data.toString(), options);

		state.respond(rendered);

		cb();
	});
};