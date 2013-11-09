var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = ['jobId'];

exports.execute = function (state, jobId, cb) {
	cb();

	mage.cronClient.runJob(jobId);
};
