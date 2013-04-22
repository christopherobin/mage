var assert = require('assert');
var Cron = require('../Cron');
var Schedule = require('../Schedule');

describe('scheduler: Cron', function () {
	it('instances should have proper instanceof', function (done) {
		var cron = new Cron('* * * * *');
		assert.ok(cron instanceof Schedule, 'cron should be an instance of Schedule.');
		done();
	});

	it('instances should step and serialise', function (done) {
		var cron = new Cron('* * * * *');
		assert.strictEqual(cron.isInvalid(), false, 'cron.isInvalid() should be false.');

		var next = cron.getNextEvent();

		for (var i = 0, tmp; i < 500; i++) {
			tmp = cron.getNextEvent(next);
			assert.strictEqual(tmp - next, 1000);
			next = tmp;
		}

		assert.strictEqual(JSON.stringify(cron), '{"crontab":"* * * * *"}');
		done();
	});

	describe('leap years', function () {
		it('basic', function (done) {
			var cron = new Cron('0 0 0 29 feb');
			var next = new Date([2099]);
			var events = [];

			assert.strictEqual(cron.isInvalid(), false);

			for (var i = 0; i < 5; i++) {
				next = cron.getNextEvent(next);
				if (!next) {
					break;
				}
				events.push(new Date(+next - next.getTimezoneOffset() * 60000).toGMTString());
			}

			assert.deepEqual(events, [
				'Fri, 29 Feb 2104 00:00:00 GMT',
				'Wed, 29 Feb 2108 00:00:00 GMT',
				'Mon, 29 Feb 2112 00:00:00 GMT',
				'Sat, 29 Feb 2116 00:00:00 GMT',
				'Thu, 29 Feb 2120 00:00:00 GMT'
			]);

			done();
		});

		it('with start date', function (done) {
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

			assert.deepEqual(events, [
				'Fri, 29 Feb 2104 00:00:00 GMT',
				'Wed, 29 Feb 2108 00:00:00 GMT',
				'Mon, 29 Feb 2112 00:00:00 GMT',
				'Sat, 29 Feb 2116 00:00:00 GMT',
				'Thu, 29 Feb 2120 00:00:00 GMT'
			]);

			done();
		});

		it('with time and date', function (done) {
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

			assert.deepEqual(events, [
				'Mon, 29 Feb 2016 00:00:00 GMT',
				'Sat, 29 Feb 2020 00:00:00 GMT'
			]);

			done();
		});

		it('with start and end dates', function (done) {
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

			assert.deepEqual(events, [
				'Thu, 29 Feb 2024 00:00:00 GMT',
				'Tue, 29 Feb 2028 00:00:00 GMT',
				'Sun, 29 Feb 2032 00:00:00 GMT'
			]);

			done();
		});
	});

	it('complex specification', function (done) {
		var cron = new Cron('*/17,1,5 */23 0 28-29 feb fri');

		assert.strictEqual(cron.isInvalid(), false);

		var next = new Date(0);
		var events = [];

		cron.next = next;

		for (var iter = 0; iter < 100; ++iter) {
			next = cron.getNextEvent(next);
			events.push(new Date(+next - next.getTimezoneOffset() * 60000).toGMTString());
		}

		assert.deepEqual(events, [
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

		done();
	});

	it('initialise with crontab', function (done) {
		var crontab = {
			crontab: '* * * * *',
			start: new Date(Date.now()),
			stop: new Date(Date.now() + 10000)
		};

		var cron = new Cron(JSON.stringify(crontab));

		assert.ok(cron instanceof Schedule, 'cron should be an instance of Schedule.');
		done();
	});

	it('initialise with invalid object', function (done) {
		var crontab = { cake: true };
		var cron = new Cron(JSON.stringify(crontab));

		assert.deepEqual(JSON.stringify(cron), '{}');
		done();
	});

	it('initialise with dodgy crontab', function (done) {
		var crontab = '* * * *';
		var cron = new Cron(JSON.stringify(crontab));
		assert.deepEqual(JSON.stringify(cron), '{}');

		crontab = '* * * * * * *';
		cron = new Cron(JSON.stringify(crontab));
		assert.deepEqual(JSON.stringify(cron), '{}');

		crontab = '* * * * * *';
		cron = new Cron(JSON.stringify(crontab));
		assert.ok(cron instanceof Schedule, 'cron should be an instance of Schedule');

		crontab = '* * * * *';
		cron = new Cron(JSON.stringify(crontab));
		assert.ok(cron instanceof Schedule, 'cron should be an instance of Schedule');

		cron = new Cron('0 0 0 0 feb');
		assert.ok(!cron.hasOwnProperty(crontab), 'bad day of the month (too early) should lead to no \'crontab\' property');

		cron = new Cron('m m m m m');
		assert.ok(!cron.hasOwnProperty(crontab), 'weird crontab should lead to no \'crontab\' property');

		done();
	});
});
