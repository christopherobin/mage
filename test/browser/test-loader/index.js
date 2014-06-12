var assert = require('assert');

var loader = require('loader');

describe('MAGE Page Loader', function () {

	it('Should accept configuration', function () {
		loader.configure({
			appVariants: {
				languages: ['nl', 'en'],
				densities: [1, 2]
			}
		});
	});

	it('Should allow language change', function () {
		loader.setLanguage('nl');
	});

	it('Should not allow unknown language', function () {
		assert.throws(function () {
			loader.setLanguage('fr');
		});
	});

	it('Should not allow non-string language', function () {
		assert.throws(function () {
			loader.setLanguage(true);
		});
	});

	it('Should allow density change', function () {
		loader.setDensity(2);
	});

	it('Should not allow unknown density', function () {
		assert.throws(function () {
			loader.setDensity(10);
		});
	});

	it('Should not allow non-number density', function () {
		assert.throws(function () {
			loader.setDensity('foo');
		});
	});
});
