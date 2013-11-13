/**
 * This user command replaces runJob (left there to allow older shokoti versions to call into this
 * app). The added benefit is the data object, which can contain meta data, and some day also custom
 * data for a job.
 */

var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = ['jobId', 'message'];

exports.execute = function (state, jobId, message, cb) {
	cb();

	mage.cronClient.runJob(jobId, message);
};
