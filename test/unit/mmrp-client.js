var assert = require('assert');
var zmq = require('zmq');

require('../..'); // register mage in codependency
var mmrp = require('../../lib/msgServer/mmrp');
var Envelope = mmrp.Envelope;

var identity = require('os').hostname();

describe('msgServer', function () {
	describe('mmrp', function () {
		it('sets up', function () {
			mmrp.setup({ host: '127.0.0.1', port: '*' });
		});

		it('should connect to a fake peer', function (done) {
			// create peer

			var router = zmq.createSocket('router');
			router.bindSync('tcp://127.0.0.1:*');
			var uri = router.getsockopt('last_endpoint');

			router.on('message', function (sender) {
				var args = [].slice.call(arguments, 1); // slice off the sender

				var received = Envelope.fromArgs(args);
				console.log('RECEIVED:', received);

				router.close();

				// disconnect
				mmrp.relayDown(uri);

				done();
			});

			// announce peer
			mmrp.relayUp(uri);

			// send envelope
			var sent = new Envelope('test', 'ABC', [mmrp.getRouterIdentity(), uri]);
			console.log('SENT:', sent);
			mmrp.send(sent);
		});


/*

			it('should format the message', function (done) {
				var data = 'some data';

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

				var client = new Client(identity);
				client.connect(router.getsockopt('last_endpoint'));
				client.send(identity, data);
			});
		});
*/
	});
});
