var mage = require('mage');
var mageLoader = require('loader');

var page = mageLoader.renderPage('home');
page.innerHTML = require('./page.html');

var desc = page.querySelector('#homeUserDescription');

if (mage.ident && mage.ident.user) {
	desc.textContent = mage.ident.user.displayName;
} else {
	desc.textContent = 'unknown';
}
