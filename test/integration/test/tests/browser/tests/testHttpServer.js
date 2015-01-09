var assert = require('assert');

function syncDownload(path, cb) {
	// synchronous, because PhantomJS just gives status 0 for non-200 responses when asynchronous
	// see: https://github.com/ariya/phantomjs/issues/11195

	var XHR = window.XMLHttpRequest;

	var xhr = new XHR();

	xhr.open('GET', path, false);

	xhr.onerror = function (error) {
		cb(error);
	};

	xhr.onreadystatechange = function () {
		if (xhr.readyState === 4) {
			cb(null, xhr);
		}
	};

	try {
		xhr.send();
	} catch (error) {
		cb(error);
	}
}


describe('HTTP Server', function () {
	var mage;

	before(function (done) {
		mage = require('mage');
		mage.session.loginAnonymous('admin', function (error) {
			assert.ifError(error);
			assert(mage.session.getKey());

			mage.useModules(require, 'test');

			mage.setup(function (error) {
				assert.ifError(error);

				done();
			});
		});
	});

	it('serves files with a correct content-type', function (done) {
		syncDownload('/foo.txt', function (error, xhr) {
			assert.ifError(error);
			assert.strictEqual(xhr.status, 200);
			assert.strictEqual(xhr.getResponseHeader('content-type').toLowerCase(), 'text/plain');
			assert.strictEqual(xhr.responseText, 'This is foo.txt');
			done();
		});
	});

	it('turns bad file exposure into 404', function (done) {
		syncDownload('/404.txt', function (error, xhr) {
			assert.ifError(error);
			assert.strictEqual(xhr.status, 404);
			done();
		});
	});
});
