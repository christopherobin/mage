var assert = require('assert');
var HeartBeat = require('../HeartBeat');
var Schedule = require('../Schedule');

describe('scheduler: HeartBeat', function () {
	describe('specified as \'1ms\'', function () {
		it('is valid', function (done) {
			var heartBeat = new HeartBeat('1ms');

			assert.ok(heartBeat instanceof Schedule);
			done();
		});

		it('steps every ms', function (done) {
			var heartBeat = new HeartBeat('1ms');
			var next = heartBeat.getNextEvent();

			for (var i = 0; i < 500; i++) {
				var tmp = heartBeat.getNextEvent(next);
				assert.strictEqual(tmp - next, 1);
				next = tmp;
			}

			done();
		});

		it('serializes to JSON as \'{"period":"1ms"}\'', function (done) {
			var heartBeat = new HeartBeat('1ms');
			assert.strictEqual(JSON.stringify(heartBeat), '{"period":"1ms"}');
			done();
		});

		it('cancel after spool', function (done) {
			var heartBeat = new HeartBeat('100ms');

			heartBeat.on('cancel', function () {
				assert.ok(true);
				done();
			});

			heartBeat.spool(undefined, function () {});
			heartBeat.cancel();
		});
	});

	describe('specified as \'1d1h1m1s1ms\'', function () {
		it('is valid', function (done) {
			var heartBeat = new HeartBeat('1d1h1m1s1ms');
			assert.strictEqual(heartBeat.isInvalid(), false);
			done();
		});

		it('steps at expected times', function (done) {
			var heartBeat = new HeartBeat('1d1h1m1s1ms');
			var next = heartBeat.getNextEvent();
			var period = 1 + 1000 * (1 + 60 * (1 + 60 * (1 + 24)));

			for (var i = 0; i < 100; i++) {
				var tmp = heartBeat.getNextEvent(next);
				assert.equal(+tmp % period, 0);
				assert.equal(tmp - next, period);
				next = tmp;
			}

			done();
		});
	});

	it('doesn\'t beat before the start date', function (done) {
		var start = Date.now() + 500;
		var beat = new HeartBeat('1ms', new Date(start));

		beat.on('run', function () {
			beat.cancel();
			assert.ok(Date.now() >= start);
			done();
		});

		beat.run();
	});

	it('doesn\'t beat after the end date', function (done) {
		var end = Date.now() - 500;
		var error = false;
		var beat = new HeartBeat('1ms', null, new Date(end));

		beat.on('run', function () {
			error = true;
		});

		beat.on('end', function () {
			assert.ok(!error, 'ran after end time');
			done();
		});

		beat.run();
	});

	it('beats the expected number of times', function (done) {
		var now = Date.now();
		var start = now + 500;
		var end = start + 500;
		var beat = new HeartBeat('50ms', new Date(start), new Date(end));
		var times = 0;

		assert.ok(!beat.isInvalid(), 'beat should be valid');

		beat.on('run', function (ms) {
			times += 1;
			assert.ok(ms % 50 === 0);
		});

		beat.on('end', function () {
			assert.strictEqual(times, 10);
			done();
		});

		beat.next = new Date(now);
		beat.run();
	});

	it('check that bad period string ignored', function (done) {
		var heartBeat = new HeartBeat('"');
		assert.ok(heartBeat instanceof HeartBeat);
		assert.strictEqual(JSON.stringify(heartBeat), '{}');
		done();
	});

	it('check initialisation with object', function (done) {
		var now = Date.now();
		var end = now + 500000;

		var heartBeat = new HeartBeat({ start: now, end: end, period: 500000 });

		// Use the parser to remove event emitter stuff;
		var actual = JSON.parse(JSON.stringify(heartBeat));
		var expected = {
			start: (new Date(now)).toISOString(),
			end: (new Date(end)).toISOString(),
			period: '8m20s' // === 500000ms
		};

		assert.ok(heartBeat instanceof HeartBeat);
		assert.deepEqual(actual, expected);
		done();
	});

	it('check initialisation with undefined', function (done) {
		var heartBeat = new HeartBeat();
		assert.strictEqual(JSON.stringify(heartBeat), '{}');
		done();
	});
});
