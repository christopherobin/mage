var fs = require('fs');
var jsonlint = require('jsonlint');

var jsonRequire = require.extensions['.json'];

require.extensions['.json'] = function (module, filename) {
	try {
		jsonRequire(module, filename);
	} catch (e) {
		var contents = fs.readFileSync(filename).toString('utf8');

		try {
			jsonlint.parse(contents);
		} catch (lintError) {
			if (typeof lintError.message === 'string') {
				lintError.message = lintError.message.replace(/\t/g, ' ');
			}

			throw lintError;
		}
	}
};

module.exports = require;