var vows = require('vows'),
	assert = require('assert'),
	Cron = require('modules/scheduler/Cron'),
	Schedule = require('modules/scheduler/Schedule');

exports.tests = vows.describe(__filename).addBatch({
	'A Cron': {
		topic: new Cron('* * * * *'),
		'is an instance of Schedule': function (topic) {
			assert.ok(topic instanceof Schedule);
		},
		'specified as "∗ ∗ ∗ ∗ ∗"': {
			topic: new Cron('* * * * *'),
			'is valid': function (topic) {
				assert.equal(topic.isInvalid(), false);
			},
			'steps every second': function (topic) {
				var next = topic.getNextEvent();

				for (var iter = 0; iter < 500; ++iter) {
					var tmp = topic.getNextEvent(next);
					assert.equal(tmp - next, 1000);
					next = tmp;
				}
			},
			'Serializes properly to JSON': function (topic) {
				assert.equal('{"crontab":"* * * * *"}', JSON.stringify(topic));
			}
		},
		'handles leap years properly': function () {
			var topic = new Cron('0 0 0 29 feb'),
				next = new Date([2099]);
			assert.equal(topic.isInvalid(), false);

			var events = [];
			for (var iter = 0; iter < 5; ++iter) {
				next = topic.getNextEvent(next);
				if (!next) {
					break;
				}
				events.push(new Date(+next - next.getTimezoneOffset() * 60000).toGMTString());
			}
			// 2100 should be skipped as it's not a leap year
			assert.deepEqual(events, [
				'Fri, 29 Feb 2104 00:00:00 GMT',
				'Wed, 29 Feb 2108 00:00:00 GMT',
				'Mon, 29 Feb 2112 00:00:00 GMT',
				'Sat, 29 Feb 2116 00:00:00 GMT',
				'Thu, 29 Feb 2120 00:00:00 GMT'
			]);
		},
		'when provided with a start date': {
			topic: new Cron('0 0 0 29 feb', new Date([2099])),
			'doesn\'t run before the start date': function (topic) {
				var next, events = [];
				for (var iter = 0; iter < 5; ++iter) {
					next = topic.getNextEvent(next);
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
			}
		},
		'when provided with an end date': {
			topic: new Cron('0 0 0 29 feb', null, new Date([2022])),
			'doesn\'t run past the end date': function (topic) {
				var next, events = [];
				for (var iter = 0; iter < 5; ++iter) {
					next = topic.getNextEvent(next);
					if (!next) {
						break;
					}
					events.push(new Date(+next - next.getTimezoneOffset() * 60000).toGMTString());
				}
				assert.deepEqual(events, [
					'Mon, 29 Feb 2016 00:00:00 GMT',
					'Sat, 29 Feb 2020 00:00:00 GMT'
				]);
			}
		},
		'when provided with both start and end dates': {
			topic: new Cron('0 0 0 29 feb', new Date([2022]), new Date([2035])),
			'runs neither before the start date nor past the end date': function (topic) {
				var next, events = [];
				for (var iter = 0; iter < 5; ++iter) {
					next = topic.getNextEvent(next);
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
			}
		},
		'specified as "∗/17,1,5 ∗/23 0 28-29 feb fri"': {
			topic: new Cron('*/17,1,5 */23 0 28-29 feb fri'),
			'is valid': function (topic) {
				assert.equal(topic.isInvalid(), false);
			},
			'steps at expected times': function (topic) {
				var next = new Date(0);
				topic.next = next;

				var events = [];
				for (var iter = 0; iter < 100; ++iter) {
					next = topic.getNextEvent(next);
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
			}
		}
	}
});
