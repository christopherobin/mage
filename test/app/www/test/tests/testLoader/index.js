var assert = require('assert');

describe('Package Loader', function () {
	var loader = require('loader');
	var Package = loader.Package;

	afterEach(function () {
		loader.removeAllListeners();
	});

	it('exposes the Package class', function () {
		assert(Package);
	});

	it('configures the loader', function () {
		loader.configure({
			appName: 'test',
			appVariants: {
				languages: ['nl', 'en'],
				densities: [1, 2]
			}
		});
	});

	it('allows to load packages after configuration', function () {
		loader.assertPackageIsLoadable('myInlinePackage');
		loader.assertPackageIsLoadable('package');
	});

	it('generates a download URL for a package', function () {
		assert.ok(loader.getPackageUrl('myInlinePackage').indexOf('/app/test/myInlinePackage?') !== -1);
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
		new Package('myInlinePackage');
	});

	var testDelimiter = '--foobar--';
	var testHtml = '<div>\n  <h1>foo bar</h1>\n</div>';
	var testCss = 'BODY {\n  background: rgb(253, 254, 255);\n}';
	var testJs = 'window.myInlinePackageTestValue = 123;';
	var htmlParent = document.createElement('div');
	var cssParent = document.createElement('div');

	it('can parse package data and run the JavaScript', function () {
		var data = [
			'Delimiter: ' + testDelimiter,
			'',
			'text/html\n' + testHtml + testDelimiter,
			'text/css\n' + testCss + testDelimiter,
			'text/javascript\n' + testJs
		].join('\n');

		var pkg = new Package('myInlinePackage');
		pkg.parse(data);

		assert.equal(testHtml, pkg.content['text/html'][0]);
		assert.equal(testCss, pkg.content['text/css'][0]);
		assert.equal(testJs, pkg.content['text/javascript'][0]);

		// ensure JS has not run yet

		assert.equal(window.myInlinePackageTestValue, undefined);
		var events = 0;

		loader.on('myInlinePackage.parsed', function (parsedPkg) {
			assert.equal(parsedPkg, pkg);
			assert.equal(window.myInlinePackageTestValue, undefined);
			events += 1;
		});

		loader.on('parsed', function (parsedPkg) {
			assert.equal(parsedPkg, pkg);
			assert.equal(window.myInlinePackageTestValue, undefined);
			events += 1;
		});

		loader.on('myInlinePackage.loaded', function (loadedPkg) {
			assert.equal(loadedPkg, pkg);
			assert.equal(window.myInlinePackageTestValue, 123);
			events += 1;
		});

		loader.on('loaded', function (loadedPkg) {
			assert.equal(loadedPkg, pkg);
			assert.equal(window.myInlinePackageTestValue, 123);
			events += 1;
		});

		loader.registerPackage(pkg);

		assert.equal(events, 4);
		assert.equal(window.myInlinePackageTestValue, 123);
	});

	it('can inject HTML/CSS into the default parent elements', function () {
		var pkg = loader.getPackage('myInlinePackage');

		pkg.injectCss();
		pkg.injectHtml();

		// check that the style got applied

		var color = getComputedStyle(document.body)['background-color'];
		assert.equal(color, 'rgb(253, 254, 255)');
	});

	it('can eject HTML/CSS from their current parents', function () {
		var elm;
		var pkg = loader.getPackage('myInlinePackage');

		elm = pkg.ejectCss();
		assert(!elm.parentNode);

		elm = pkg.ejectHtml();
		assert(!elm.parentNode);
	});

	it('allows custom injection points', function () {
		var pkg = loader.getPackage('myInlinePackage');
		pkg.parentElements['text/html'] = htmlParent;
		pkg.parentElements['text/css'] = cssParent;
	});

	it('can inject HTML/CSS into the registered parents', function () {
		var elm = loader.getPackage('myInlinePackage').injectCss();
		assert.equal(elm.parentNode, cssParent);
		assert.equal(elm.innerText, testCss);

		elm = loader.injectHtml('myInlinePackage');
		assert.equal(elm.parentNode, htmlParent);
		assert.equal(elm.innerHTML, testHtml);
	});

	it('emits display events', function () {
		var pkg = loader.getPackage('myInlinePackage');
		var elm = pkg.getHtml();
		var events = 0;

		loader.on('myInlinePackage.display', function (dispElm, dispPkg) {
			assert.equal(dispElm, elm);
			assert.equal(dispPkg, pkg);
			events += 1;
		});

		loader.on('display', function (dispElm, dispPkg) {
			assert.equal(dispElm, elm);
			assert.equal(dispPkg, pkg);
			events += 1;
		});

		var displayedElm = loader.displayPackage('myInlinePackage');
		assert.equal(displayedElm, elm);
		assert.equal(events, 2);
	});

	it('can destroy a package', function () {
		var pkg = loader.getPackage('myInlinePackage');
		pkg.destroy();

		assert.equal(htmlParent.firstChild, null);
		assert.equal(cssParent.firstChild, null);
	});

	it('cannot download a package in an incompatible client config', function (done) {
		assert.equal(loader.connectionState, 'online');

		loader.on('error', function (error) {
			assert.ok(error);
			assert.equal(error.isRetrying, true);

			done();
		});

		loader.loadPackage('mypackage', function () {
			throw new Error('Download should not have succeeded');
		});
	});

	it('can download a package in the right client config', function (done) {
		loader.setLanguage('en');
		loader.setDensity(1);

		loader.on('warning', function (warning) {
			throw warning;
		});

		loader.on('error', function (error) {
			throw error;
		});

		loader.on('offline', function (error) {
			throw error;
		});

		loader.on('maintenance', function (error) {
			throw error;
		});

		loader.loadPackage('mypackage', function (error, pkg) {
			assert.ifError(error);
			assert.ok(pkg);
			window.require('mypackage');
			assert.equal(window.mypackageTestValue, 456);
			assert(pkg.getCss());
			pkg.destroy();
			done();
		});
	});
});
