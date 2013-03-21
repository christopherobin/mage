var Cron = require('../Cron');
var Schedule = require('../Schedule');

exports['is an instance of Schedule'] = function (test) {
	test.expect(1);

	var cron = new Cron('* * * * *');
	test.ok(cron instanceof Schedule, 'cron should be an instance of Schedule.');
	test.done();
};

exports['steps and serialises'] = function (test) {
	test.expect(502);

	var cron = new Cron('* * * * *');
	test.strictEqual(cron.isInvalid(), false, 'cron.isInvalid() should be false.');

	var next = cron.getNextEvent();

	for (var i = 0, tmp; i < 500; i++) {
		tmp = cron.getNextEvent(next);
		test.strictEqual(tmp - next, 1000);
		next = tmp;
	}

	test.strictEqual(JSON.stringify(cron), '{"crontab":"* * * * *"}');
	test.done();
};

exports['leap years'] = {
	basic: function (test) {
		test.expect(2);

		var cron = new Cron('0 0 0 29 feb');
		var next = new Date([2099]);
		var events = [];

		test.strictEqual(cron.isInvalid(), false);

		for (var i = 0; i < 5; i++) {
			next = cron.getNextEvent(next);
			if (!next) {
				break;
			}
			events.push(new Date(+next - next.getTimezoneOffset() * 60000).toGMTString());
		}

		test.deepEqual(events, [
			'Fri, 29 Feb 2104 00:00:00 GMT',
			'Wed, 29 Feb 2108 00:00:00 GMT',
			'Mon, 29 Feb 2112 00:00:00 GMT',
			'Sat, 29 Feb 2116 00:00:00 GMT',
			'Thu, 29 Feb 2120 00:00:00 GMT'
		]);

		test.done();
	},
	'with start date': function (test) {
		test.expect(1);

		var cron = new Cron('0 0 0 29 feb', new Date([2099]));

		var next;
		var events = [];

		for (var i = 0; i < 5; i++) {
			next = cron.getNextEvent(next);
			if (!next) {
				break;
			}
			events.push(new Date(+next - next.getTimezoneOffset() * 60000).toGMTString());
		}

		test.deepEqual(events, [
			'Fri, 29 Feb 2104 00:00:00 GMT',
			'Wed, 29 Feb 2108 00:00:00 GMT',
			'Mon, 29 Feb 2112 00:00:00 GMT',
			'Sat, 29 Feb 2116 00:00:00 GMT',
			'Thu, 29 Feb 2120 00:00:00 GMT'
		]);

		test.done();
	},
	'with end date': function (test) {
		test.expect(1);

		var cron = new Cron('0 0 0 29 feb', null, new Date([2022]));

		var next;
		var events = [];

		for (var iter = 0; iter < 5; ++iter) {
			next = cron.getNextEvent(next);
			if (!next) {
				break;
			}
			events.push(new Date(+next - next.getTimezoneOffset() * 60000).toGMTString());
		}

		test.deepEqual(events, [
			'Mon, 29 Feb 2016 00:00:00 GMT',
			'Sat, 29 Feb 2020 00:00:00 GMT'
		]);

		test.done();
	},
	'with start and end dates': function (test) {
		test.expect(1);

		var cron = new Cron('0 0 0 29 feb', new Date([2022]), new Date([2035]));

		var next;
		var events = [];

		for (var iter = 0; iter < 5; ++iter) {
			next = cron.getNextEvent(next);
			if (!next) {
				break;
			}
			events.push(new Date(+next - next.getTimezoneOffset() * 60000).toGMTString());
		}

		test.deepEqual(events, [
			'Thu, 29 Feb 2024 00:00:00 GMT',
			'Tue, 29 Feb 2028 00:00:00 GMT',
			'Sun, 29 Feb 2032 00:00:00 GMT'
		]);

		test.done();
	}
};

exports['complex specification'] = function (test) {
	test.expect(2);

	var cron = new Cron('*/17,1,5 */23 0 28-29 feb fri');

	test.strictEqual(cron.isInvalid(), false);

	var next = new Date(0);
	var events = [];

	cron.next = next;

	for (var iter = 0; iter < 100; ++iter) {
		next = cron.getNextEvent(next);
		events.push(new Date(+next - next.getTimezoneOffset() * 60000).toGMTString());
	}

	test.deepEqual(events, [
		'Fri, 06 Feb 1970 00:00:00 GMT',
		'Fri, 06 Feb 1970 00:00:01 GMT',
		'Fri, 06 Feb 1970 00:00:05 GMT',
		'Fri, 06 Feb 1970 00:00:17 GMT',
		'Fri, 06 Feb 1970 00:00:34 GMT',
		'Fri, 06 Feb 1970 00:00:51 GMT',
		'Fri, 06 Feb 1970 00:23:00 GMT',
		'Fri, 06 Feb 1970 00:23:01 GMT',
		'Fri, 06 Feb 1970 00:23:05 GMT',
		'Fri, 06 Feb 1970 00:23:17 GMT',
		'Fri, 06 Feb 1970 00:23:34 GMT',
		'Fri, 06 Feb 1970 00:23:51 GMT',
		'Fri, 06 Feb 1970 00:46:00 GMT',
		'Fri, 06 Feb 1970 00:46:01 GMT',
		'Fri, 06 Feb 1970 00:46:05 GMT',
		'Fri, 06 Feb 1970 00:46:17 GMT',
		'Fri, 06 Feb 1970 00:46:34 GMT',
		'Fri, 06 Feb 1970 00:46:51 GMT',
		'Fri, 13 Feb 1970 00:00:00 GMT',
		'Fri, 13 Feb 1970 00:00:01 GMT',
		'Fri, 13 Feb 1970 00:00:05 GMT',
		'Fri, 13 Feb 1970 00:00:17 GMT',
		'Fri, 13 Feb 1970 00:00:34 GMT',
		'Fri, 13 Feb 1970 00:00:51 GMT',
		'Fri, 13 Feb 1970 00:23:00 GMT',
		'Fri, 13 Feb 1970 00:23:01 GMT',
		'Fri, 13 Feb 1970 00:23:05 GMT',
		'Fri, 13 Feb 1970 00:23:17 GMT',
		'Fri, 13 Feb 1970 00:23:34 GMT',
		'Fri, 13 Feb 1970 00:23:51 GMT',
		'Fri, 13 Feb 1970 00:46:00 GMT',
		'Fri, 13 Feb 1970 00:46:01 GMT',
		'Fri, 13 Feb 1970 00:46:05 GMT',
		'Fri, 13 Feb 1970 00:46:17 GMT',
		'Fri, 13 Feb 1970 00:46:34 GMT',
		'Fri, 13 Feb 1970 00:46:51 GMT',
		'Fri, 20 Feb 1970 00:00:00 GMT',
		'Fri, 20 Feb 1970 00:00:01 GMT',
		'Fri, 20 Feb 1970 00:00:05 GMT',
		'Fri, 20 Feb 1970 00:00:17 GMT',
		'Fri, 20 Feb 1970 00:00:34 GMT',
		'Fri, 20 Feb 1970 00:00:51 GMT',
		'Fri, 20 Feb 1970 00:23:00 GMT',
		'Fri, 20 Feb 1970 00:23:01 GMT',
		'Fri, 20 Feb 1970 00:23:05 GMT',
		'Fri, 20 Feb 1970 00:23:17 GMT',
		'Fri, 20 Feb 1970 00:23:34 GMT',
		'Fri, 20 Feb 1970 00:23:51 GMT',
		'Fri, 20 Feb 1970 00:46:00 GMT',
		'Fri, 20 Feb 1970 00:46:01 GMT',
		'Fri, 20 Feb 1970 00:46:05 GMT',
		'Fri, 20 Feb 1970 00:46:17 GMT',
		'Fri, 20 Feb 1970 00:46:34 GMT',
		'Fri, 20 Feb 1970 00:46:51 GMT',
		'Fri, 27 Feb 1970 00:00:00 GMT',
		'Fri, 27 Feb 1970 00:00:01 GMT',
		'Fri, 27 Feb 1970 00:00:05 GMT',
		'Fri, 27 Feb 1970 00:00:17 GMT',
		'Fri, 27 Feb 1970 00:00:34 GMT',
		'Fri, 27 Feb 1970 00:00:51 GMT',
		'Fri, 27 Feb 1970 00:23:00 GMT',
		'Fri, 27 Feb 1970 00:23:01 GMT',
		'Fri, 27 Feb 1970 00:23:05 GMT',
		'Fri, 27 Feb 1970 00:23:17 GMT',
		'Fri, 27 Feb 1970 00:23:34 GMT',
		'Fri, 27 Feb 1970 00:23:51 GMT',
		'Fri, 27 Feb 1970 00:46:00 GMT',
		'Fri, 27 Feb 1970 00:46:01 GMT',
		'Fri, 27 Feb 1970 00:46:05 GMT',
		'Fri, 27 Feb 1970 00:46:17 GMT',
		'Fri, 27 Feb 1970 00:46:34 GMT',
		'Fri, 27 Feb 1970 00:46:51 GMT',
		'Sat, 28 Feb 1970 00:00:00 GMT',
		'Sat, 28 Feb 1970 00:00:01 GMT',
		'Sat, 28 Feb 1970 00:00:05 GMT',
		'Sat, 28 Feb 1970 00:00:17 GMT',
		'Sat, 28 Feb 1970 00:00:34 GMT',
		'Sat, 28 Feb 1970 00:00:51 GMT',
		'Sat, 28 Feb 1970 00:23:00 GMT',
		'Sat, 28 Feb 1970 00:23:01 GMT',
		'Sat, 28 Feb 1970 00:23:05 GMT',
		'Sat, 28 Feb 1970 00:23:17 GMT',
		'Sat, 28 Feb 1970 00:23:34 GMT',
		'Sat, 28 Feb 1970 00:23:51 GMT',
		'Sat, 28 Feb 1970 00:46:00 GMT',
		'Sat, 28 Feb 1970 00:46:01 GMT',
		'Sat, 28 Feb 1970 00:46:05 GMT',
		'Sat, 28 Feb 1970 00:46:17 GMT',
		'Sat, 28 Feb 1970 00:46:34 GMT',
		'Sat, 28 Feb 1970 00:46:51 GMT',
		'Fri, 05 Feb 1971 00:00:00 GMT',
		'Fri, 05 Feb 1971 00:00:01 GMT',
		'Fri, 05 Feb 1971 00:00:05 GMT',
		'Fri, 05 Feb 1971 00:00:17 GMT',
		'Fri, 05 Feb 1971 00:00:34 GMT',
		'Fri, 05 Feb 1971 00:00:51 GMT',
		'Fri, 05 Feb 1971 00:23:00 GMT',
		'Fri, 05 Feb 1971 00:23:01 GMT',
		'Fri, 05 Feb 1971 00:23:05 GMT',
		'Fri, 05 Feb 1971 00:23:17 GMT'
	]);

	test.done();
};

exports['Initialise with crontab'] = function (test) {
	test.expect(1);

	var crontab = {
		crontab: '* * * * *',
		start: new Date(Date.now()),
		stop: new Date(Date.now() + 10000)
	};

	var cron = new Cron(JSON.stringify(crontab));

	test.ok(cron instanceof Schedule, 'cron should be an instance of Schedule.');
	test.done();
};

exports['Initialise with invalid object'] = function (test) {
	test.expect(1);

	var crontab = { cake: true };
	var cron = new Cron(JSON.stringify(crontab));

	test.deepEqual(JSON.stringify(cron), '{}');
	test.done();
};

exports['initialise with dodgy crontab'] = function (test) {
	test.expect(6);

	var crontab = '* * * *';
	var cron = new Cron(JSON.stringify(crontab));
	test.deepEqual(JSON.stringify(cron), '{}');

	crontab = '* * * * * * *';
	cron = new Cron(JSON.stringify(crontab));
	test.deepEqual(JSON.stringify(cron), '{}');

	crontab = '* * * * * *';
	cron = new Cron(JSON.stringify(crontab));
	test.ok(cron instanceof Schedule, 'cron should be an instance of Schedule');

	crontab = '* * * * *';
	cron = new Cron(JSON.stringify(crontab));
	test.ok(cron instanceof Schedule, 'cron should be an instance of Schedule');

	cron = new Cron('0 0 0 0 feb');
	test.ok(!cron.hasOwnProperty(crontab), 'bad day of the month (too early) should lead to no \'crontab\' property');

	cron = new Cron('m m m m m');
	test.ok(!cron.hasOwnProperty(crontab), 'weird crontab should lead to no \'crontab\' property');

	test.done();
};