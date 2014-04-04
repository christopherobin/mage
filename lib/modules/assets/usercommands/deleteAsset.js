var mage = require('../../../mage');

exports.params = ['appName', 'context', 'ident'];

exports.access = 'admin';


/**
 *
 * @param {State} state
 * @param {string} appName
 * @param {string} context
 * @param {string} ident
 * @param {function} cb
 */

exports.execute = function (state, appName, context, ident, cb) {
	mage.assets.deleteAsset(state, appName, context, ident, cb);
};
