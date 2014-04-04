var desc = document.getElementById('homeUserDescription');
var mage = require('mage');

if (mage.ident && mage.ident.user) {
	desc.textContent = mage.ident.user.displayName;
} else {
	desc.textContent = 'unknown';
}
