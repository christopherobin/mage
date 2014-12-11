var pkg = require('mage-loader.js').getPackage('styleguide');
pkg.addHtml(require('./page.html'));
pkg.injectHtml();
