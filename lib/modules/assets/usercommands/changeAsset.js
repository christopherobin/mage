var mage = require('../../../mage');

exports.params = ['appName', 'context', 'ident', 'changes'];

exports.acl = ['admin'];


/**
 * Change: {
 *   operation: 'change', 'delete'
 *   context: 'img', 'bgm', etc
 *   language: 'default', 'en', etc
 *   profiles: undefined or ['one', 'two']
 *   file: array of buffers
 *   format: file extension
 *   relPath: relative path to the asset on disk if one already exists
 * }
 *
 * @param {State} state
 * @param {string} appName
 * @param {string} context
 * @param {string} ident
 * @param {array} changes array of Change objects
 * @param {function} cb
 */

exports.execute = function (state, appName, context, ident, changes, cb) {
	mage.assets.updateVariants(state, appName, context, ident, changes, function (error, newLocalizedAssets) {
		if (error) {
			return cb(error);
		}

		state.respond(newLocalizedAssets);

		cb();
	});
};
