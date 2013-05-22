var mage = require('../../../mage');

exports.params = ['appName', 'context', 'ident', 'changes', 'files'];

exports.access = 'admin';


/**
 * Change: {
 *   operation: 'change', 'delete'
 *   context: 'img', 'bgm', etc
 *   language: 'default', 'en', etc
 *   profiles: undefined or ['one', 'two']
 *   file: integer representing index in files array
 *   format: file extension
 * }
 *
 * @param {State} state
 * @param {string} appName
 * @param {string} context
 * @param {string} ident
 * @param {array} changes  array of Change objects
 * @param {array} files
 * @param {function} cb
 */

exports.execute = function (state, appName, context, ident, changes, files, cb) {
	mage.assets.updateVariants(state, appName, context, ident, changes, files, function (error, newLocalizedAssets) {
		if (error) {
			return cb(error);
		}

		state.respond(newLocalizedAssets);

		cb();
	});
};
