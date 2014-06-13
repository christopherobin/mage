var assert = require('assert');

var loader = require('loader');

describe('MAGE Page Loader', function () {

	it('Configures the loader', function () {
		loader.configure({
			appVariants: {
				languages: ['nl', 'en'],
				densities: [1, 2]
			}
		});
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
});
