var mage = require('mage');

var pkg = require('loader').getPackage('home');
pkg.addHtml(require('./page.html'));
var page = pkg.injectHtml();


var desc = page.querySelector('#homeUserDescription');

if (mage.ident && mage.ident.user) {
	desc.textContent = mage.ident.user.displayName;
} else {
	desc.textContent = 'unknown';
}
