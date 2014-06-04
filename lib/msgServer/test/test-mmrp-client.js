var assert = require('assert');
var zmq = require('zmq');

require('../../..'); // register mage in codependency
var meta = require('../mmrp/meta');
var Client = require('../mmrp/client').Client;

describe('msgServer', function () {
	describe('mmrp', function () {
		describe('Client', function () {
			it('constructs the object', function (done) {
				var client = new Client();
				assert.strictEqual(typeof client.socket, 'object');
				assert.strictEqual(client.socket.type, 'dealer');
				assert.strictEqual(client.allowSend, false);
				assert.strictEqual(client.badSendReported, false);
				done();
			});

			it('should connect to the router', function (done) {
				var router = zmq.createSocket('router');
				router.bindSync('tcp://127.0.0.1:*');
				router.on('message', function () {
					router.close();
					done();
				});

				var client = new Client();
				client.connect(router.getsockopt('last_endpoint'));
			});

			it('should format the message', function (done) {
				var data = 'some data';
				var identity = require('os').hostname();

				var router = zmq.createSocket('router');
				router.bindSync('tcp://127.0.0.1:*');
				router.on('message', function (header, from, _data, metadata) {
					metadata = new meta.Meta(metadata);
					if (metadata.flags & meta.FLAGS.IGNORE) {
						return;
					}

					assert.strictEqual(from.toString(), identity);
					assert.strictEqual(_data.toString(), data);
					router.close();
					done();
				});

				var client = new Client();
				client.connect(router.getsockopt('last_endpoint'));
				client.send(identity, data);
			});
		});
	});
});
