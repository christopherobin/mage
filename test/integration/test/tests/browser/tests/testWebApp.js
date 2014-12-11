var assert = require('assert');

function download(path, cb) {
	var XHR = window.XMLHttpRequest;

	var xhr = new XHR();

	xhr.open('GET', path, true);

	xhr.onerror = function (error) {
		cb(error);
	};

	xhr.onreadystatechange = function () {
		if (xhr.readyState === 4) {
			cb(null, xhr);
		}
	};

	xhr.send();
}


describe('WebApp', function () {
	it('Can download the test indexPage', function (done) {
		download('/app/test', function (error, xhr) {
			assert.ifError(error);
			assert.strictEqual(xhr.status, 200);
			assert.strictEqual(xhr.getResponseHeader('content-type').toLowerCase(), 'text/html; charset=utf-8');
			done();
		});
	});

	it('Can download an XML indexPage', function (done) {
		download('/app/test/gadget.xml', function (error, xhr) {
			assert.ifError(error);
			assert.strictEqual(xhr.status, 200);
			assert.strictEqual(xhr.getResponseHeader('content-type').toLowerCase(), 'application/xml; charset=utf-8');
			assert(xhr.responseXML);

			var root = xhr.responseXML.documentElement;
			assert(root);
			assert(root.tagName === 'gadget');
			done();
		});
	});
});
