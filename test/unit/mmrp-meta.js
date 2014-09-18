var assert = require('assert');

var meta = require('../../lib/msgServer/mmrp/meta');

describe('msgServer', function () {
	describe('mmrp', function () {
		describe('Meta', function () {
			it('constructs the object with a Buffer', function (done) {
				var buffer = new Buffer('some buffer');
				var metadata = new meta.Meta(buffer);
				assert.strictEqual(metadata.getBuffer().toString('hex'),
					buffer.toString('hex'));
				done();
			});

			it('constructs the object with all the parameters', function (done) {
				var ttl = 32;
				var dataType = meta.DATATYPE.JSON;
				var flags = meta.FLAGS.REPLY_EXPECTED;
				var buffer = new Buffer([0, ttl, dataType, flags >> 8, flags]);
				var metadata = new meta.Meta(ttl, dataType, flags);
				assert.strictEqual(metadata.getBuffer().toString('hex'),
					buffer.toString('hex'));
				assert.strictEqual(metadata.getBuffer().length, 5);
				assert.strictEqual(metadata.dataPosition, 0);
				assert.strictEqual(metadata.toString(), 0);
				assert.strictEqual(metadata.ttl, ttl);
				assert.strictEqual(metadata.dataType, dataType);
				assert.strictEqual(metadata.flags, flags);
				done();
			});

			it('constructs the object with default values if needed', function (done) {
				var buffer = new Buffer([0, 16, 0, 0, 0]);
				var metadata = new meta.Meta();
				assert.strictEqual(metadata.getBuffer().toString('hex'),
					buffer.toString('hex'));
				assert.strictEqual(metadata.getBuffer().length, 5);
				assert.strictEqual(metadata.dataPosition, 0);
				assert.strictEqual(metadata.toString(), 0);
				assert.strictEqual(metadata.ttl, 16);
				assert.strictEqual(metadata.dataType, meta.DATATYPE.UNKNOWN);
				assert.strictEqual(metadata.flags, meta.FLAGS.NONE);
				done();
			});

			it('should accept combination of 8 bits flags', function (done) {
				var flags = meta.FLAGS.REPLY_EXPECTED |
					meta.FLAGS.AUTO_DESERIALIZE |
					meta.FLAGS.PAYLOAD_MODIFIED;
				var metadata = new meta.Meta(null, null, flags);
				assert.strictEqual(metadata.getBuffer().length, 5);
				assert.strictEqual(metadata.flags, flags);
				assert.notEqual(metadata.flags & meta.FLAGS.REPLY_EXPECTED, 0);
				assert.notEqual(metadata.flags & meta.FLAGS.AUTO_DESERIALIZE, 0);
				assert.notEqual(metadata.flags & meta.FLAGS.PAYLOAD_MODIFIED, 0);
				done();
			});

			it('should accept 16 bits flags', function (done) {
				var flags = meta.FLAGS.IGNORE;
				var metadata = new meta.Meta(null, null, flags);
				assert.strictEqual(metadata.getBuffer().length, 5);
				assert.strictEqual(metadata.flags, flags);
				done();
			});

			it('should accept combination of 8 bits and 16 bits flags', function (done) {
				var flags = meta.FLAGS.REPLY_EXPECTED |
					meta.FLAGS.AUTO_DESERIALIZE |
					meta.FLAGS.PAYLOAD_MODIFIED |
					meta.FLAGS.IGNORE;
				var metadata = new meta.Meta(null, null, flags);
				assert.strictEqual(metadata.getBuffer().length, 5);
				assert.strictEqual(metadata.flags, flags);
				assert.notEqual(metadata.flags & meta.FLAGS.REPLY_EXPECTED, 0);
				assert.notEqual(metadata.flags & meta.FLAGS.AUTO_DESERIALIZE, 0);
				assert.notEqual(metadata.flags & meta.FLAGS.PAYLOAD_MODIFIED, 0);
				assert.notEqual(metadata.flags & meta.FLAGS.IGNORE, 0);
				done();
			});

			describe('serialize()', function () {
				it('should not modify an object with an unknown type', function (done) {
					var metadata = new meta.Meta(null, meta.DATATYPE.UNKNOWN, null);
					var data = new Buffer('some data');
					var result = metadata.serialize(data);
					assert.strictEqual(data, result);
					assert.strictEqual(typeof result, 'object');
					assert.strictEqual(result instanceof Buffer, true);
					done();
				});

				it('should convert the Buffer into a String for UTF8STRING data', function (done) {
					var metadata = new meta.Meta(null, meta.DATATYPE.UTF8STRING, null);
					var data = new Buffer('some data');
					var result = metadata.serialize(data);
					assert.strictEqual(data.toString(), result);
					assert.strictEqual(typeof result, 'string');
					done();
				});

				it('should convert the object into a String for JSON data', function (done) {
					var metadata = new meta.Meta(null, meta.DATATYPE.JSON, null);
					var data = { some: 'data' };
					var result = metadata.serialize(data);
					assert.deepEqual(JSON.stringify(data), result);
					assert.strictEqual(typeof result, 'string');
					done();
				});
			});

			describe('deserialize()', function () {
				it('should not modify an object with an unknown type', function (done) {
					var metadata = new meta.Meta(null, meta.DATATYPE.UNKNOWN, null);
					var data = new Buffer('some data');
					var result = metadata.deserialize(data);
					assert.strictEqual(data, result);
					assert.strictEqual(typeof result, 'object');
					assert.strictEqual(result instanceof Buffer, true);
					done();
				});

				it('should convert the Buffer into a String for UTF8STRING data', function (done) {
					var metadata = new meta.Meta(null, meta.DATATYPE.UTF8STRING, null);
					var data = new Buffer('some data');
					var result = metadata.deserialize(data);
					assert.strictEqual(data.toString(), result);
					assert.strictEqual(typeof result, 'string');
					done();
				});

				it('should convert the Buffer into an object for JSON data', function (done) {
					var metadata = new meta.Meta(null, meta.DATATYPE.JSON, null);
					var expected = { some: 'data' };
					var data = new Buffer(JSON.stringify(expected));
					var result = metadata.deserialize(data);
					assert.deepEqual(expected, result);
					assert.strictEqual(typeof result, 'object');
					done();
				});
			});
		});
	});
});
