var Schedule = require('../Schedule');

exports['handles bad schedule with isInvalid'] = function (test) {
	test.expect(2);

	var schedule = new Schedule('junk', 'junk');

	schedule.on('error', function (message) {
		test.ok(message, 'Invalid Schedule');
	});

	schedule.run();
	test.strictEqual(schedule.getNextEvent(), null);
	test.done();
};
