var mithril = require('../../mithril'),
    contexts = require('../contexts'),
    async = require('async');

var helpers = mithril.core.helpers;


exports.build = function (buildTarget, language, contextName, data, cb) {
	if (!data) {
		return cb(null, '');
	}

	// we match: $  [a-z] (builder)  \.[a-z] (context, optional)  \( [a-z] \) (key)

	var matches = data.match(/\$[a-z0-9_\-]+(\.[a-z0-9_\-]+)?\(.+?\);?/ig);

	if (!matches || matches.length === 0) {
		return cb(null, data);
	}

	// parse the matches

	var found = [];	// builder.context : key
	var uniqueMatches = {};

	for (var i = 0, len = matches.length; i < len; i++) {
		var match = matches[i];

		if (uniqueMatches.hasOwnProperty(match)) {
			// multiple replacements of the same thing
			continue;
		}

		uniqueMatches[match] = true;

		var parsed = match;

		// chop off the optional final semicolon

		if (parsed[parsed.length - 1] === ';') {
			parsed = parsed.substr(0, parsed.length - 1);
		}

		// extract data

		parsed = parsed.substr(1, parsed.length - 2).split('(');
		if (parsed.length === 2) {
			var part = parsed[0].split('.');

			var builderName = part[0];
			var parsedContextName = part[1] || contextName;
			var key = parsed[1];

			// drop surrounding quotes from the key

			if (key[0] === key[key.length - 1] && (key[0] === '"' || key[0] === "'")) {
				key = key.substring(1, key.length - 1);
			}

			var context = contexts.get(parsedContextName);

			if (!context) {
				mithril.core.logger.error('No compatible context found for:', match);
				data = data.split(match).join('');
			} else {
				found.push({
					match:       match,
					builderName: builderName,
					context:     context,
					key:         key
				});
			}
		}
	}

	// build all found build targets

	async.forEachSeries(
		found,
		function (item, callback) {
			var allowPostProcessing = (item.context.name !== contextName);

			var subTarget = new mithril.core.app.BuildTarget(buildTarget.app, item.builderName, item.key, item.context, null, null, allowPostProcessing);

			subTarget.rootPath = buildTarget.rootPath;

			subTarget.build(language, function (error, buildResult) {
				if (error) {
					callback(error);
				} else {
					data = data.split(item.match).join(buildResult || '');
					callback();
				}
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

