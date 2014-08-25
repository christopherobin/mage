var pkg = require('loader').getPackage('styleguide');
pkg.addHtml(require('./page.html'));
pkg.injectHtml();
