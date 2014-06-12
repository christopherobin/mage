var assert = require('assert');
var zmq = require('zmq');

require('../../'); // register mage in codependency
var meta = require('../../lib/msgServer/mmrp/meta');
var Relay = require('../../lib/msgServer/mmrp/relay').Relay;

var identity = require('os').hostname();

function createPacket(addr, data, metadata) {
	if (typeof addr === 'string') {
		addr = addr.split('/');
	}

	if (!metadata) {
		metadata = new meta.Meta();
	}
	metadata.dataPosition = addr.length;

	return addr.concat(data, metadata.data);
}

describe('msgServer', function () {
	describe('mmrp', function () {
		describe('Relay', function () {
			it('constructs the object', function (done) {
				var relay = new Relay(identity);
				assert.strictEqual(typeof relay.router, 'object');
				assert.strictEqual(relay.router.type, 'router');
				assert.strictEqual(typeof relay.dealer, 'object');
				assert.strictEqual(relay.dealer.type, 'dealer');
				assert.strictEqual(relay.dealer.identity, identity);
				assert.strictEqual(relay.identity, identity);
				assert.strictEqual(relay.allowSend, false);
				assert.strictEqual(relay.badSendReported, false);
				done();
			});

			it('should receive message from client', function (done) {
				var client = zmq.createSocket('dealer');

				var relay = new Relay(identity);
				relay.bind('tcp://127.0.0.1:*');
				relay.router.on('message', function () {
					assert.strictEqual(relay.allowSend, true);
					relay.close();
					done();
				});

				client.connect(relay.router.getsockopt('last_endpoint'));
				client.send('');
			});

			it('should receive the message', function (done) {
				var packetData = 'some data';

				var client = zmq.createSocket('dealer');

				var relay = new Relay(identity);
				relay.bind('tcp://127.0.0.1:*');
				relay.on('message', function (data) {
					assert.strictEqual(data.toString(), packetData);
					relay.close();
					done();
				});

				client.connect(relay.router.getsockopt('last_endpoint'));

				var packet = createPacket(identity, packetData);
				client.send(packet);
			});

			it('should receive the message and deserialize string', function (done) {
				var packetData = 'some data';

				var client = zmq.createSocket('dealer');

				var relay = new Relay(identity);
				relay.bind('tcp://127.0.0.1:*');
				relay.on('message', function (data) {
					assert.strictEqual(data, packetData);
					relay.close();
					done();
				});

				client.connect(relay.router.getsockopt('last_endpoint'));

				var metadata = new meta.Meta(null,
					meta.DATATYPE.UTF8STRING,
					meta.FLAGS.AUTO_DESERIALIZE);
				var packet = createPacket(identity, packetData, metadata);
				client.send(packet);
			});

			it('should receive the message and deserialize json', function (done) {
				var packetData = { some: 'data' };

				var client = zmq.createSocket('dealer');

				var relay = new Relay(identity);
				relay.bind('tcp://127.0.0.1:*');
				relay.on('message', function (data) {
					assert.deepEqual(data, packetData);
					relay.close();
					done();
				});

				client.connect(relay.router.getsockopt('last_endpoint'));

				var metadata = new meta.Meta(null,
					meta.DATATYPE.JSON,
					meta.FLAGS.AUTO_DESERIALIZE);
				var packet = createPacket(identity, JSON.stringify(packetData), metadata);
				client.send(packet);
			});

			it('should forward the message if it is not the recipient', function (done) {
				var packetData = 'some data';

				var client = zmq.createSocket('dealer');

				var relay = new Relay(identity);
				relay.bind('tcp://127.0.0.1:*');
				relay.on('request', function (sender, data, returnPath) {
					assert.deepEqual(sender, []);
					assert.strictEqual(data.toString(), packetData);
					assert.deepEqual(returnPath, []);
					relay.close();
					done();
				});

				client.connect(relay.router.getsockopt('last_endpoint'));

				var packet = createPacket('someone else', packetData);
				client.send(packet);
			});

			it('should forward the message if it is not the recipient', function (done) {
				var packetData = 'some data';

				var client = zmq.createSocket('dealer');

				var relay = new Relay(identity);
				relay.bind('tcp://127.0.0.1:*');
				relay.on('request', function (sender, data, returnPath) {
					assert.strictEqual(data.toString(), packetData);
					assert.notStrictEqual(returnPath, []);
					relay.close();
					done();
				});

				client.connect(relay.router.getsockopt('last_endpoint'));

				var metadata = new meta.Meta(null, null, meta.FLAGS.REPLY_EXPECTED);
				var packet = createPacket('someone else', packetData, metadata);
				client.send(packet);
			});
		});
	});
});
