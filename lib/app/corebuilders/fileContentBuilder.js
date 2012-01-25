var mithril = require('../../mithril'),
    contexts = require('../contexts'),
    async = require('async');


function parseLine(line) {
	// parses a line, and returns the first build target description in it, false if none found

	var m = line.match(/\$([a-z0-9_\-]+)(\.[a-z0-9_\-]+)?\((.+)/i);
	if (!m) {
		return false;
	}

	// m[1]: builder, m[2]: context, m[3]: start of the key (end brace needs to be found)

	var result = {
		src: '$' + m[1] + (m[2] || '') + '(',		// append the key (with end-brace and semi colon postfix)
		builderName: m[1],
		contextName: (m[2] ? m[2].substr(1) : null),
		key: ''
	};

	var keystr = m[3];
	var opened = 1;
	var wrapper = null;

	for (var i = 0, len = keystr.length; i < len; i++) {
		var c = keystr[i];

		// if we're already done getting the key, finish up

		if (opened === 0) {
			// if the closing brace is followed by a semi colon, append it to the source string

			if (c === ';') {
				result.src += c;
			}

			return result;
		}

		result.src += c;

		// first character may be a string wrapping character (quote)

		if (i === 0 && (c === '"' || c === "'")) {
			wrapper = c;
			continue;
		}

		// check if the character is a the closing string wrapper character

		if (wrapper && c === wrapper) {
			wrapper = null;
			continue;
		}

		// if we're not in a wrapper, braces have meaning

		if (!wrapper) {
			if (c === ')') {
				opened -= 1;

				if (opened === 0) {
					// end of the key
					continue;
				}
			} else if (c === '(') {
				opened += 1;
			}
		}

		// we're still parsing the key, so append the character

		result.key += c;
	}

	if (opened === 0) {
		return result;
	}

	return false;
}


exports.build = function (buildTarget, language, contextName, data, cb) {
	if (!data) {
		return cb(null, '');
	}

	// find all build targets mentioned in data

	var found = [];	// builder.context : key
	var offset = 0;

	while (true) {
		var start = data.indexOf('$', offset);

		if (start === -1) {
			break;
		}

		var lineEnd = data.indexOf('\n', start);
		if (lineEnd === -1) {
			lineEnd = data.length;
		}

		var line = parseLine(data.substring(start, lineEnd));
		if (line) {
			offset = start + line.src.length;

			var context = contexts.get(line.contextName || contextName);

			if (!context) {
				mithril.core.logger.error('No compatible context found for:', (line.contextName || contextName));

				data = data.split(line.src).join('');
			} else {
				line.context = context;

				found.push(line);
			}
		} else {
			offset = lineEnd;
		}
	}

	// build all found build targets

	async.forEachSeries(
		found,
		function (item, callback) {
			// if the key contains build targets, we need to build them recursively first

			exports.build(buildTarget, language, contextName, item.key, function (error, keydata) {
				if (error) {
					return callback(error);
				}

				// the key is now a fully built/resolved key, time to build our build target

				item.key = keydata;

				var allowPostProcessing = (item.context.name !== contextName);

				var subTarget = new mithril.core.app.BuildTarget(buildTarget.app, item.builderName, item.key, item.context, null, null, allowPostProcessing);

				subTarget.rootPath = buildTarget.rootPath;

				subTarget.build(language, function (error, buildResult) {
					if (error) {
						callback(error);
					} else {
						data = data.split(item.src).join(buildResult || '');
						callback();
					}
				});
			});
		},
		function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, data);
		}
	);
};

