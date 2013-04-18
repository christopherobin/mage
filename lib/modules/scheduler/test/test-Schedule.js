var assert = require('assert');
var Schedule = require('../Schedule');

describe('scheduler: Schedule', function () {
	it('handles bad schedule with isInvalid', function (done) {
		var schedule = new Schedule('junk', 'junk');

		schedule.on('error', function (message) {
			assert.ok(message, 'Invalid Schedule');
		});

		schedule.run();
		assert.strictEqual(schedule.getNextEvent(), null);
		done();
	});
});
