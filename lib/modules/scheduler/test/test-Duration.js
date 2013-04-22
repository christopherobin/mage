var assert = require('assert');
var Duration = require('../Duration');

describe('scheduler: Duration', function () {
	it('handle initialisation with empty string', function (done) {
		var duration = new Duration('"');

		assert.ok(duration instanceof Duration);
		done();
	});

	it('handle initialisation with number', function (done) {
		var duration = new Duration(10);

		assert.ok(duration instanceof Duration);
		done();
	});

	it('handle initialisation with 0', function (done) {
		var duration = new Duration(0);

		assert.ok(duration instanceof Duration);
		done();
	});

	it('initialisation with negative number should be invalid', function (done) {
		var duration = new Duration(-10);

		assert.ok(duration.isInvalid());
		done();
	});

	it('initialisation with valid duration should yield valid duration', function (done) {
		var duration = new Duration('5m10s');
		var anotherDuration = new Duration(duration);

		assert.ok(duration instanceof Duration);
		assert.ok(!duration.isInvalid());
		assert.ok(!anotherDuration.isInvalid());
		assert.deepEqual(duration, anotherDuration);
		done();
	});

	it('initialisation with invalid duration should yield invalid duration', function (done) {
		var duration = new Duration(-10);
		var anotherDuration = new Duration(duration);

		assert.ok(duration.isInvalid());
		assert.ok(anotherDuration.isInvalid());
		done();
	});
});
