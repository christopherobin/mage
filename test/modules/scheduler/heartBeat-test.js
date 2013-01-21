var vows = require('vows'),
	assert = require('assert'),
	events = require('events'),
	HeartBeat = require('modules/scheduler/HeartBeat'),
	Schedule = require('modules/scheduler/Schedule');

vows.describe(__filename).addBatch({
	'A HeartBeat': {
		topic: new HeartBeat('1ms'),
		'is an instance of Schedule': function (topic) {
			assert.ok(topic instanceof Schedule);
		},
		'specified as "1ms"': {
			topic: new HeartBeat('1ms'),
			'is valid': function (topic) {
				assert.equal(topic.isInvalid(), false);
			},
			'steps every millisecond': function (topic) {
				var next = topic.getNextEvent();

				for (var iter = 0; iter < 500; ++iter) {
					var tmp = topic.getNextEvent(next);
					assert.equal(tmp - next, 1);
					next = tmp;
				}
			},
			'serializes to JSON as \'{"period":"1ms"}\'': function (topic) {
				assert.equal('{"period":"1ms"}', JSON.stringify(topic));
			}
		},
		'specified as "1d1h1m1s1ms"': {
			topic: new HeartBeat('1d1h1m1s1ms'),
			'is valid': function (topic) {
				assert.equal(topic.isInvalid(), false);
			},
			'steps at expected times': function (topic) {
				var next = topic.getNextEvent(),
					period = 1 + 1000 * (1 + 60 * (1 + 60 * (1 + 24)));

				for (var iter = 0; iter < 100; ++iter) {
					var tmp = topic.getNextEvent(next);
					assert.equal(+tmp % period, 0);
					assert.equal(tmp - next, period);
					next = tmp;
				}
			}
		},
		'when provided with a start date': {
			topic: function () {
				var that = this,
					start = Date.now() + 500,
					beat = new HeartBeat('1ms', new Date(start));
				beat.on('run', function () {
					var now = Date.now();
					if (now < start) {
						that.callback("Date.now() < start");
					} else {
						that.callback();
						beat.cancel();
					}
				});
				beat.run();
			},
			'doesn\'t beat before the start date': function (err) {
				assert.ok(!err, String(err));
			}
		},
		'when provided with an end date': {
			topic: function () {
				var that = this,
					end = Date.now() - 500,
					error = null,
					beat = new HeartBeat('1ms', null, new Date(end));
				beat.on('run', function () {
					error = "Damn!";
				});
				beat.on('end', function () {
					that.callback(error);
				});
				beat.run();
			},
			'doesn\'t beat after the end date': function (err) {
				assert.ok(!err, String(err && err.stack || err));
			}
		},
		'when provided with both start and end dates': {
			topic: function () {
				var that = this,
					now = Date.now(),
					start = now + 500,
					end = start + 500,
					beat = new HeartBeat('50ms', new Date(start), new Date(end)),
					times = 0;

				beat.on('run', function (ms) {
					++times;
					if (ms % 50 !== 0) {
						that.callback(new Error("Damn! " + ms + " % 50 !== 0"));
					}
				});

				beat.on('end', function () {
					if (times === 10) {
						that.callback();
					} else {
						that.callback(new Error("Expected 10, got " + times));
					}
				});

				beat.next = new Date(now);
				beat.run();
			},
			'beats the expected number of times': function (err) {
				assert.ok(!err, String(err));
			}
		}
	}
}).export(module);
