var assert = require('assert');
var mage = require('mage');
var Tome = require('tomes').Tome;

window.describe('archivist', function () {
	window.describe('mget result style', function () {
		before(function (done) {
			mage.user.login('new', 'password', function (error) {
				assert.ifError(error);

				done();
			});
		});

		it('Array style', function (done) {
			var query = [];
			var expectedResult = [];
			for (var i = 0; i < 5; ++i) {
				query.push({
					topic: 'inventory',
					index: { userId: 'user' + i }
				});
				expectedResult.push({
					money: 50 + i,
					items: {}
				});
			}
			mage.archivist.mget(query, {}, function (error, multiData) {
				assert.ifError(error);
				assert.strictEqual(Array.isArray(multiData), true);
				assert.strictEqual(multiData.length, 5);
				assert.deepEqual(Tome.unTome(multiData), expectedResult);
				done();
			});
		});

		it('Object style', function (done) {
			var query = {};
			var expectedResult = {};
			for (var i = 0; i < 5; ++i) {
				query['key' + i] = {
					topic: 'inventory',
					index: { userId: 'user' + i }
				};
				expectedResult['key' + i] = {
					money: 50 + i,
					items: {}
				};
			}
			mage.archivist.mget(query, {}, function (error, multiData) {
				assert.ifError(error);
				assert.strictEqual(typeof multiData, 'object');
				assert.deepEqual(Tome.unTome(multiData), expectedResult);
				done();
			});
		});
	});

	window.describe('cached value', function () {
		it('get', function (done) {
			mage.archivist.get('inventory', {
				userId: 'user0'
			}, {}, function (error, data) {
				assert.ifError(error);

				// Add a listener which is attached to the cached value and shouldn't be removed
				function listener() { }
				data.on('readable', listener);

				mage.archivist.get('inventory', {
					userId: 'user0'
				}, {}, function (error, data) {
					assert.ifError(error);
					assert.strictEqual(data.listeners('readable').length, 2);
					data.off('readable', listener);
					done();
				});
			});
		});

		it('mget', function (done) {
			var query = [];
			for (var i = 0; i < 5; ++i) {
				query.push({
					topic: 'inventory',
					index: { userId: 'user' + i }
				});
			}
			mage.archivist.mget(query, {}, function (error, multiData) {
				assert.ifError(error);

				function listener() { }
				multiData.forEach(function (data) {
					// Add a listener which is attached to the cached value and shouldn't be removed
					data.on('readable', listener);
				});

				mage.archivist.mget(query, {}, function (error, multiData) {
					assert.ifError(error);
					multiData.forEach(function (data) {
						assert.strictEqual(data.listeners('readable').length, 2);
						data.off('readable', listener);
					});
					done();
				});
			});
		});
	});

	window.describe.only('events order', function () {
		before(function (done) {
			mage.user.login('new', 'password', function (error) {
				assert.ifError(error);

				done();
			});
		});

		it('events should not come after the end of the user command', function (done) {
			mage.archivist.get('inventory', {
				userId: 'user0'
			}, {}, function (error, data) {
				assert.ifError(error);

				var money = data.money + 10;

				mage.inventory.give('user0', 10, function (error, response) {
					assert.ifError(error);

					assert.strictEqual(response, null);
					assert.strictEqual(data.money.valueOf(), money);

					done();
				});
			});
		});
	});
});
