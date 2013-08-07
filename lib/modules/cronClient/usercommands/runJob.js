var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = ['jobId'];

exports.execute = function (state, jobId, cb) {
	mage.cronClient.runJob(jobId);

	cb();
};
