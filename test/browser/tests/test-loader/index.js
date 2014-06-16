var assert = require('assert');

describe('MAGE Page Loader', function () {

	var loader = require('loader');
	var Package = loader.Package;


	it('Configures the loader', function () {
		loader.configure({
			appName: 'test-app',
			appVariants: {
				languages: ['nl', 'en'],
				densities: [1, 2]
			}
		});
	});

	it('Can load packages after configuration', function () {
		loader.assertPackageIsLoadable('mypackage');
	});

	it('Can generate a download URL for a package', function () {
		assert.equal(loader.getPackageUrl('mypackage').indexOf('/app/test-app/mypackage?'), 0);
	});

	it('Allows language change', function () {
		loader.setLanguage('nl');
	});

	it('Does not allow unknown languages', function () {
		assert.throws(function () {
			loader.setLanguage('fr');
		});
	});

	it('Does not allow non-string languages', function () {
		assert.throws(function () {
			loader.setLanguage(true);
		});
	});

	it('Allows density change', function () {
		loader.setDensity(2);
	});

	it('Does not allow unknown densities', function () {
		assert.throws(function () {
			loader.setDensity(10);
		});
	});

	it('Does not allow non-number densities', function () {
		assert.throws(function () {
			loader.setDensity('foo');
		});
	});

	it('Can create Package objects', function () {
		new Package('mypackage');
	});

	var testDelimiter = '--foobar--';
	var testHtml = '<div>\n  <h1>foo bar</h1>\n</div>';
	var testCss = 'BODY {\n  color: red;\n}';

	it('Can parse package data', function () {
		var data = [
			'Delimiter: ' + testDelimiter,
			'',
			'text/html\n' + testHtml + testDelimiter,
			'text/css\n' + testCss
		].join('\n');

		var pkg = new Package('mypackage');
		pkg.parse(data);

		assert.equal(testHtml, pkg.content['text/html'][0]);
		assert.equal(testCss, pkg.content['text/css'][0]);

		loader.registerPackage(pkg);
	});

	it('Can inject CSS into the document', function () {
		var elm = loader.getPackage('mypackage').injectCss();
		assert(elm.parentNode, 'Style element should have a parent node');
		assert.equal(elm.innerText, testCss);
	});

	it('Can inject HTML into the document', function () {
		var elm = loader.injectHtml('mypackage');
		assert(elm.parentNode, 'HTML element should have a parent node');
		assert.equal(elm.innerHTML, testHtml);
	});
});
