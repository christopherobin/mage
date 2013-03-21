var HeartBeat = require('../HeartBeat');
var Schedule = require('../Schedule');

exports['specified as \'1ms\''] = {
	'is valid': function (test) {
		var heartBeat = new HeartBeat('1ms');
		test.expect(1);

		test.ok(heartBeat instanceof Schedule);
		test.done();
	},
	'steps every ms': function (test) {
		var heartBeat = new HeartBeat('1ms');
		test.expect(500);

		var next = heartBeat.getNextEvent();

		for (var i = 0; i < 500; i++) {
			var tmp = heartBeat.getNextEvent(next);
			test.equal(tmp - next, 1);
			next = tmp;
		}

		test.done();
	},
	'serializes to JSON as \'{"period":"1ms"}\'': function (test) {
		test.expect(1);
		var heartBeat = new HeartBeat('1ms');
		test.strictEqual(JSON.stringify(heartBeat), '{"period":"1ms"}');
		test.done();
	},
	'cancel after spool': function (test) {
		test.expect(1);
		var heartBeat = new HeartBeat('100ms');

		heartBeat.on('cancel', function () {
			test.ok(true);
			test.done();
		});

		heartBeat.spool(undefined, function () {});
		heartBeat.cancel();
	}
};

exports['specified as \'1d1h1m1s1ms\''] = {
	'is valid': function (test) {
		var heartBeat = new HeartBeat('1d1h1m1s1ms');
		test.expect(1);
		test.strictEqual(heartBeat.isInvalid(), false);
		test.done();
	},
	'steps at expected times': function (test) {
		var heartBeat = new HeartBeat('1d1h1m1s1ms');
		test.expect(200);

		var next = heartBeat.getNextEvent();
		var period = 1 + 1000 * (1 + 60 * (1 + 60 * (1 + 24)));

		for (var i = 0; i < 100; i++) {
			var tmp = heartBeat.getNextEvent(next);
			test.equal(+tmp % period, 0);
			test.equal(tmp - next, period);
			next = tmp;
		}

		test.done();
	}
};

exports['doesn\'t beat before the start date'] = function (test) {
	test.expect(1);

	var start = Date.now() + 500;
	var beat = new HeartBeat('1ms', new Date(start));

	beat.on('run', function () {
		beat.cancel();
		test.ok(Date.now() >= start);
		test.done();
	});

	beat.run();
};

exports['doesn\'t beat after the end date'] = function (test) {
	test.expect(1);

	var end = Date.now() - 500;
	var error = false;
	var beat = new HeartBeat('1ms', null, new Date(end));

	beat.on('run', function () {
		error = true;
	});

	beat.on('end', function () {
		test.ok(!error, 'ran after end time');
		test.done();
	});

	beat.run();
};

exports['beats the expected number of times'] = function (test) {
	test.expect(12);

	var now = Date.now();
	var start = now + 500;
	var end = start + 500;
	var beat = new HeartBeat('50ms', new Date(start), new Date(end));
	var times = 0;

	test.ok(!beat.isInvalid(), 'beat should be valid');

	beat.on('run', function (ms) {
		times += 1;
		test.ok(ms % 50 === 0);
	});

	beat.on('end', function () {
		test.strictEqual(times, 10);
		test.done();
	});

	beat.next = new Date(now);
	beat.run();
};

exports['check that bad period string ignored'] = function (test) {
	test.expect(2);

	var heartBeat = new HeartBeat('"');
	test.ok(heartBeat instanceof HeartBeat);
	test.strictEqual(JSON.stringify(heartBeat), '{}');
	test.done();
};

exports['check initialisation with object'] = function (test) {
	test.expect(2);

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

	test.ok(heartBeat instanceof HeartBeat);
	test.deepEqual(actual, expected);
	test.done();
};

exports['check initialisation with undefined'] = function (test) {
	test.expect(1);

	var heartBeat = new HeartBeat();

	test.strictEqual(JSON.stringify(heartBeat), '{}');
	test.done();
};