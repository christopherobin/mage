/**
 * The runJob user command has been deprecated in favor of startJob
 */

var mage = require('../../../mage');

exports.acl = ['*'];

exports.params = ['jobId'];

exports.execute = function (state, jobId, cb) {
	cb();

	mage.cronClient.runJob(jobId);
};
