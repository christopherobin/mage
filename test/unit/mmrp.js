var assert = require('assert');
var zmq = require('zmq');

require('../..'); // register mage in codependency
var mmrp = require('../../lib/msgServer/mmrp');
var MmrpNode = mmrp.MmrpNode;
var Envelope = mmrp.Envelope;

var identity = require('os').hostname();

function createCounter(n, test, cb) {
	var counted = 0;

	if (!cb) {
		cb = test;
		test = null;
	}

	assert.equal(typeof n, 'number');
	assert.equal(typeof cb, 'function');

	return function () {
		counted += 1;

		assert(counted <= n, 'Event fired more than ' + n + ' times');

		if (test) {
			test.apply(null, arguments);
		}

		if (counted === n) {
			cb();
		}
	};
}


describe('MMRP', function () {
	describe('single node network', function () {
		function createNetwork(relayCount) {
			relayCount = relayCount || 5;

			var relays = [];

			for (var i = 1; i <= relayCount; i += 1) {
				relays.push(new MmrpNode('both', { host: '127.0.0.1', port: '*' }, 'cluster' + i));
			}

			return relays;
		}

		function destroyNetwork(relays) {
			relays.forEach(function (relay) {
				relay.close();
			});
		}

		function announceNetwork(relays, cb) {
			var connectionsPerRelay = relays.length - 1;  // the other relays
			var expected = relays.length * connectionsPerRelay;

			var count = createCounter(expected, function () {
				// make sure all connections make sense

				relays.forEach(function (relay) {
					assert.equal(Object.keys(relay.relays).length, connectionsPerRelay);
					assert.equal(Object.keys(relay.clients).length, 0);
				});

				cb();
			});

			relays.forEach(function (relay) {
				relay.on('handshake', count);
			});

			relays.forEach(function (relay) {
				relays.forEach(function (peer) {
					relay.relayUp(peer.routerUri, peer.clusterId);
				});
			});
		}


		it('instantiates', function () {
			destroyNetwork(createNetwork());
		});

		it('connects', function (done) {
			var relays = createNetwork();
			announceNetwork(relays, function () {
				destroyNetwork(relays);
				done();
			});
		});

		it('sends a message from one client to another relay', function (done) {
			var relays = createNetwork();
			announceNetwork(relays, function () {
				var a = relays[0];
				var b = relays[1];

				b.on('delivery.hello', function (envelope) {
					assert.strictEqual(envelope.messages[0].toString(), 'world');
					destroyNetwork(relays);
					done();
				});

				a.send(new Envelope('hello', 'world', [b.identity]));
			});
		});

		it('broadcasts', function (done) {
			var relays = createNetwork();
			announceNetwork(relays, function () {
				var expected = relays.length - 1;

				function test(envelope) {
					assert.strictEqual(envelope.messages[0].toString(), 'cruel world');
				}

				var count = createCounter(expected, test, function () {
					destroyNetwork(relays);
					done();
				});

				for (var i = 0; i < relays.length; i += 1) {
					var relay = relays[i];

					if (i === 0) {
						relay.broadcast(new Envelope('bye', 'cruel world'));
					} else {
						relay.on('delivery.bye', count);
					}
				}
			});
		});
	});

	describe('clustered network', function () {
		function createNetwork(relayCount, clientCount) {
			relayCount = relayCount || 4;
			clientCount = clientCount || 4;

			var result = {
				clientsPerRelay: clientCount,
				relayCount: relayCount,
				total: relayCount * clientCount,
				clients: [],
				relays: []
			};

			var i, j;

			for (i = 0; i < relayCount; i += 1) {
				var clusterId = 'cluster' + (i + 1);

				result.relays.push(new MmrpNode('relay', { host: '127.0.0.1', port: '*' }, clusterId));
				result.clients[i] = [];

				for (j = 0; j < clientCount; j += 1) {
					result.clients[i].push(new MmrpNode('client', { host: '127.0.0.1', port: '*' }, clusterId));
				}
			}

			return result;
		}

		function destroyNetwork(network) {
			network.relays.forEach(function (relay, index) {
				relay.close();

				network.clients[index].forEach(function (client) {
					client.close();
				});
			});
		}

		function announceNetwork(network, cb) {
			// clients will handshake to their own relay, and relays to each other

			var expected =
				network.relayCount * network.clientsPerRelay +
				network.relayCount * (network.relayCount - 1);

			var count = createCounter(expected, function () {
				// make sure all connections make sense

				network.relays.forEach(function (relay) {
					var relayIds = Object.keys(relay.relays);    // incoming connections from peers
					var clientIds = Object.keys(relay.clients);  // clients of this relay

					assert.equal(relayIds.length, network.relayCount - 1);
					assert.equal(clientIds.length, network.clientsPerRelay);
				});

				cb();
			});

			network.relays.forEach(function (relay, index) {
				network.clients[index].forEach(function (client) {
					client.on('handshake', function () {
						throw new Error('Client received a handshake');
					});
				});

				relay.on('handshake', count);
			});

			network.relays.forEach(function (relay) {
				network.clients.forEach(function (clientGroup) {
					clientGroup.forEach(function (client) {
						client.relayUp(relay.routerUri, relay.clusterId);
					});
				});

				network.relays.forEach(function (peer) {
					peer.relayUp(relay.routerUri, relay.clusterId);
				});
			});
		}


		it('instantiates', function () {
			destroyNetwork(createNetwork());
		});

		it('connects', function (done) {
			var network = createNetwork();
			announceNetwork(network, function () {
				destroyNetwork(network);
				done();
			});
		});

		it('can send from one client to another', function (done) {
			// even though we won't use MmrpNode this way (we use a store as a middle-man), this should
			// still work

			var network = createNetwork();
			announceNetwork(network, function () {
				var route = [
					network.relays[0].identity,
					network.relays[2].identity,
					network.clients[2][0].identity
				];

				network.clients[0][0].send(new Envelope('alltheway', 'hello', route));
				network.clients[2][0].on('delivery.alltheway', function (envelope) {
					assert(envelope);
					assert.strictEqual(envelope.messages[0].toString(), 'hello');

					destroyNetwork(network);
					done();
				});
			});
		});

		it('can send many buffers at once', function (done) {
			var network = createNetwork();
			announceNetwork(network, function () {
				var route = [
					network.relays[0].identity,
					network.relays[2].identity,
					network.clients[2][0].identity
				];

				var message = [new Buffer('hello'), new Buffer('there'), new Buffer([1, 2, 3])];

				network.clients[0][0].send(new Envelope('alltheway', message, route));
				network.clients[2][0].on('delivery.alltheway', function (envelope) {
					assert(envelope);
					assert.equal(envelope.messages.length, 3);
					assert.deepEqual(envelope.messages, message);

					destroyNetwork(network);
					done();
				});
			});
		});

		it('can broadcast from a client', function (done) {
			var network = createNetwork();
			announceNetwork(network, function () {
				var expected = network.relayCount + network.relayCount * network.clientsPerRelay;

				var count = createCounter(expected, function () {
					destroyNetwork(network);

					done();
				});

				network.relays.forEach(function (relay, index) {
					relay.on('delivery.allofyou', count);

					network.clients[index].forEach(function (client) {
						client.on('delivery.allofyou', count);
					});
				});

				network.clients[0][0].broadcast(new Envelope('allofyou', 'hi!'));
			});
		});

		it('can broadcast from a relay', function (done) {
			var network = createNetwork();
			announceNetwork(network, function () {
				var expected = network.relayCount + network.relayCount * network.clientsPerRelay;

				var count = createCounter(expected, function () {
					destroyNetwork(network);

					done();
				});

				network.relays.forEach(function (relay, index) {
					relay.on('delivery.allofyou', count);

					network.clients[index].forEach(function (client) {
						client.on('delivery.allofyou', count);
					});
				});

				network.relays[0].broadcast(new Envelope('allofyou', 'hi!'));
			});
		});
	});
});
