var assert = require('assert');

require('../../'); // register mage in codependency
var meta = require('../../lib/msgServer/mmrp/meta');
var Client = require('../../lib/msgServer/mmrp/client').Client;
var Relay = require('../../lib/msgServer/mmrp/relay').Relay;
var Message = require('../../lib/msgServer/store').Message;

var identity = require('os').hostname();

describe('msgServer', function () {
	describe('mmrp', function () {
		describe('Client/Relay', function () {
			it('echo server', function (done) {
				var client = new Client(identity + ':client');
				var relay = new Relay(identity + ':relay');

				client.on('message', function (sendToAddr, data, metadata) {
					assert.strictEqual(sendToAddr.toString(), 'session address');
					assert.strictEqual(data, 'some data');
					assert.strictEqual(metadata.dataType,
						meta.DATATYPE.UTF8STRING);
					assert.strictEqual(metadata.flags,
						meta.FLAGS.IS_RESPONSE_PKT | meta.FLAGS.AUTO_DESERIALIZE);
					client.close();
					relay.close();
					done();
				});

				relay.on('message', function (data, returnPath, _metadata) {
					var metadata = new meta.Meta(
						null,
						_metadata.dataType,
						(_metadata.flags | meta.FLAGS.IS_RESPONSE_PKT) ^ meta.FLAGS.REPLY_EXPECTED
					);
					var packet = [returnPath[0], data];
					metadata.dataPosition = packet.length;
					packet.push(returnPath.slice(1), metadata.data);
					relay.sendReply(metadata, packet);
				});

				relay.bind('tcp://127.0.0.1:*');
				client.connect(relay.router.getsockopt('last_endpoint'));

				var metadata = new meta.Meta(null,
					meta.DATATYPE.UTF8STRING,
					meta.FLAGS.AUTO_DESERIALIZE | meta.FLAGS.REPLY_EXPECTED);
				client.send([identity + ':relay'], ['session address', 'some data'], metadata);
			});

			it('cluster with two relays', function (done) {
				var client = [], relay = [];
				var i;

				for (i = 0; i < 2; ++i) {
					relay[i] = new Relay(identity + ':relay:' + i);
					relay[i].bind('tcp://127.0.0.1:*');

					client[i] = new Client(identity + ':client:' + i);
				}

				function onMessage(data, returnPath, _metadata) {
					var metadata = new meta.Meta(
						null,
						_metadata.dataType,
						(_metadata.flags | meta.FLAGS.IS_RESPONSE_PKT) ^ meta.FLAGS.REPLY_EXPECTED
					);
					var msg = Message.unpack(data);

					var packet = [msg.user];
					metadata.dataPosition = packet.length;
					packet.push(msg.data, returnPath, metadata.data);

					assert.strictEqual(packet[0].toString(), 'session address');
					assert.strictEqual(packet[1].toString(), 'some data');
					assert.strictEqual(packet[2][0].toString(), identity + ':relay:0');
					assert.strictEqual(new meta.Meta(packet[3]).flags,
						meta.FLAGS.IS_RESPONSE_PKT);
					assert.strictEqual(new meta.Meta(packet[3]).dataPosition,
						1);

					done();
				}
				relay[1].on('message', onMessage);

				for (i = 0; i < 2; ++i) {
					relay[1 - i].connect(relay[i].router.getsockopt('last_endpoint'));
					client[i].connect(relay[i].router.getsockopt('last_endpoint'));
				}

				var metadata = new meta.Meta(null,
					null,
					meta.FLAGS.REPLY_EXPECTED);
				var msg = Message.pack('session address', null, 'some data');
				// Send a message from client0 to relay1
				client[0].send(
					[identity + ':relay:1'],
					msg,
					metadata);
			});

			it.skip('cluster with three relays', function (done) {
				var client = [], relay = [];
				var i;

				for (i = 0; i < 3; ++i) {
					relay[i] = new Relay(identity + ':relay:' + i);
					relay[i].bind('tcp://127.0.0.1:*');

					client[i] = new Client(identity + ':client:' + i);
				}

				var msgReceived = 0;
				function onMessage(data, returnPath, _metadata) {
					var metadata = new meta.Meta(
						null,
						_metadata.dataType,
						(_metadata.flags | meta.FLAGS.IS_RESPONSE_PKT) ^ meta.FLAGS.REPLY_EXPECTED
					);
					var msg = Message.unpack(data);

					var packet = [msg.user];
					metadata.dataPosition = packet.length;
					packet.push(msg.data, returnPath, metadata.data);

					assert.strictEqual(packet[0].toString(), 'session address');
					assert.strictEqual(packet[1].toString(), 'some data');
					assert.strictEqual(new meta.Meta(packet[3]).flags,
						meta.FLAGS.IS_RESPONSE_PKT);
					assert.strictEqual(new meta.Meta(packet[3]).dataPosition,
						1);

					if (++msgReceived === 4) {
						done();
					}
				}

				for (i = 0; i < 3; ++i) {
					relay[i].on('message', onMessage);
					for (var j = 0; j < 3; ++j) {
						if (i !== j) {
							relay[i].connect(relay[j].router.getsockopt('last_endpoint'));
						}
					}
					client[i].connect(relay[i].router.getsockopt('last_endpoint'));
				}

				var metadata = new meta.Meta(null,
					null,
					meta.FLAGS.REPLY_EXPECTED);
				var msg = Message.pack('session address', null, 'some data');
				client[0].send(
					[identity + ':relay:1'],
					msg,
					metadata);
				client[0].send(
					[identity + ':relay:2'],
					msg,
					metadata);
				client[1].send(
					[identity + ':relay:0'],
					msg,
					metadata);
				client[2].send(
					[identity + ':relay:0'],
					msg,
					metadata);
			});
		});
	});
});
