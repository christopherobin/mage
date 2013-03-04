var Duration = require('../Duration');

exports['handle initialisation with empty string'] = function (test) {
	test.expect(1);
	var duration = new Duration('"');

	test.ok(duration instanceof Duration);
	test.done();
};

exports['handle initialisation with number'] = function (test) {
	test.expect(1);
	var duration = new Duration(10);

	test.ok(duration instanceof Duration);
	test.done();
};

exports['handle initialisation with 0'] = function (test) {
	test.expect(1);
	var duration = new Duration(0);

	test.ok(duration instanceof Duration);
	test.done();
};

exports['initialisation with negative number should be invalid'] = function (test) {
	test.expect(1);
	var duration = new Duration(-10);

	test.ok(duration.isInvalid());
	test.done();
};

exports['initialisation with valid duration should yield valid duration'] = function (test) {
	test.expect(4);
	var duration = new Duration('5m10s');
	var anotherDuration = new Duration(duration);

	test.ok(duration instanceof Duration);
	test.ok(!duration.isInvalid());
	test.ok(!anotherDuration.isInvalid());
	test.deepEqual(duration, anotherDuration);
	test.done();
};

exports['initialisation with invalid duration should yield invalid duration'] = function (test) {
	test.expect(2);
	var duration = new Duration(-10);
	var anotherDuration = new Duration(duration);

	test.ok(duration.isInvalid());
	test.ok(anotherDuration.isInvalid());
	test.done();
};