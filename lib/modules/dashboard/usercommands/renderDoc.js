var mage = require('../../../mage');
var fs = require('fs');
var path = require('path');
var marked = require('marked');
var hljs = require('highlight.js');

exports.access = 'admin';

exports.params = ['relPath'];


// highlight.js will only recognise a language by one specific name. GitHub is more flexible, and we
// want to be as compatible as can be with that. This map provides a translation from one name to
// the one that highlight.js will understand.

var compatibleNames = {
	js: 'javascript',
	sh: 'bash'
};


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

				if (compatibleNames.hasOwnProperty(lang)) {
					lang = compatibleNames[lang];
				}

				// two versions of language availability tests, to bridge the API change from
				// highlight.js 7.5.0 to the upcoming release

				if ((hljs.getLanguage && !hljs.getLanguage(lang) ||   // post 7.5.0
					(hljs.LANGUAGES && !hljs.LANGUAGES[lang]))) {     // 7.5.0 and older
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