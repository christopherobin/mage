var assert = require('assert');

describe('Package Loader', function () {
	var loader = require('loader');
	var Package = loader.Package;

	it('exposes the Package class', function () {
		assert(Package);
	});

	it('configures the loader', function () {
		loader.configure({
			appName: 'test-app',
			appVariants: {
				languages: ['nl', 'en'],
				densities: [1, 2]
			}
		});
	});

	it('allows to load packages after configuration', function () {
		loader.assertPackageIsLoadable('mypackage');
	});

	it('generates a download URL for a package', function () {
		assert.ok(loader.getPackageUrl('mypackage').indexOf('/app/test-app/mypackage?') !== -1);
	});

	it('allows language change', function () {
		loader.setLanguage('nl');
	});

	it('does not allow unknown languages', function () {
		assert.throws(function () {
			loader.setLanguage('fr');
		});
	});

	it('does not allow non-string languages', function () {
		assert.throws(function () {
			loader.setLanguage(true);
		});
	});

	it('allows density change', function () {
		loader.setDensity(2);
	});

	it('does not allow unknown densities', function () {
		assert.throws(function () {
			loader.setDensity(10);
		});
	});

	it('does not allow non-number densities', function () {
		assert.throws(function () {
			loader.setDensity('foo');
		});
	});

	it('can create Package objects', function () {
		new Package('mypackage');
	});

	var testDelimiter = '--foobar--';
	var testHtml = '<div>\n  <h1>foo bar</h1>\n</div>';
	var testCss = 'BODY {\n  background: #eee;\n}';
	var testJs = 'window.mypackageTestValue = 123;';
	var htmlParent = document.createElement('div');
	var cssParent = document.createElement('div');

	it('can parse package data', function () {
		var data = [
			'Delimiter: ' + testDelimiter,
			'',
			'text/html\n' + testHtml + testDelimiter,
			'text/css\n' + testCss + testDelimiter,
			'text/javascript\n' + testJs
		].join('\n');

		var pkg = new Package('mypackage');
		pkg.parse(data);

		assert.equal(testHtml, pkg.content['text/html'][0]);
		assert.equal(testCss, pkg.content['text/css'][0]);
		assert.equal(testJs, pkg.content['text/javascript'][0]);

		// ensure JS has not run yet

		assert.equal(window.mypackageTestValue, undefined);
		var events = 0;

		loader.on('mypackage.parsed', function (parsedPkg) {
			assert.equal(parsedPkg, pkg);
			assert.equal(window.mypackageTestValue, undefined);
			events += 1;
		});

		loader.on('parsed', function (parsedPkg) {
			assert.equal(parsedPkg, pkg);
			assert.equal(window.mypackageTestValue, undefined);
			events += 1;
		});

		loader.on('mypackage.loaded', function (loadedPkg) {
			assert.equal(loadedPkg, pkg);
			assert.equal(window.mypackageTestValue, 123);
			events += 1;
		});

		loader.on('loaded', function (loadedPkg) {
			assert.equal(loadedPkg, pkg);
			assert.equal(window.mypackageTestValue, 123);
			events += 1;
		});

		loader.registerPackage(pkg);

		assert.equal(events, 4);
		assert.equal(window.mypackageTestValue, 123);
	});

	it('allows custom injection points', function () {
		var pkg = loader.getPackage('mypackage');
		pkg.parentElements['text/html'] = htmlParent;
		pkg.parentElements['text/css'] = cssParent;
	});

	it('can inject CSS into the registered parent', function () {
		var elm = loader.getPackage('mypackage').injectCss();
		assert.equal(elm.parentNode, cssParent);
		assert.equal(elm.innerText, testCss);
	});

	it('can inject HTML into the registered parent', function () {
		var elm = loader.injectHtml('mypackage');
		assert.equal(elm.parentNode, htmlParent);
		assert.equal(elm.innerHTML, testHtml);
	});

	it('emits display events', function () {
		var pkg = loader.getPackage('mypackage');
		var elm = pkg.getHtml();
		var events = 0;

		loader.on('mypackage.display', function (dispElm, dispPkg) {
			assert.equal(dispElm, elm);
			assert.equal(dispPkg, pkg);
			events += 1;
		});

		loader.on('display', function (dispElm, dispPkg) {
			assert.equal(dispElm, elm);
			assert.equal(dispPkg, pkg);
			events += 1;
		});

		var displayedElm = loader.displayPackage('mypackage');
		assert.equal(displayedElm, elm);
		assert.equal(events, 2);
	});

	it('can destroy a package', function () {
		var pkg = loader.getPackage('mypackage');
		pkg.destroy();

		assert.equal(htmlParent.firstChild, null);
		assert.equal(cssParent.firstChild, null);
	});
});
