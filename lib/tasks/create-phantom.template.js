/*
 * This PhantomJS script allows you to easily run the "%APP_NAME%" app.
 * To do this simply run this file with optionally an extra path to append to the URL.
 *
 * This will then load up the page and run it.
 *
 * Usage:
 *      phantomjs <THIS FILE> <PATH>
 *
 * Example:
 *      phantomjs %FILENAME% /questbot
 *
 * NOTE: THIS IS NOT A NODEJS OR GAME FRONTEND FILE. OUR FRAMEWORK DOES NOT APPLY HERE
 *       PLEASE REFER TO PHANTOMJS DOCUMENTATION FOR MORE INFORMATION!
 *
 *       http://phantomjs.org
 *       https://github.com/ariya/phantomjs/wiki
 */


console.log('PhantomJS loader for MAGE app: %APP_NAME%');
console.log('');

var page = require('webpage').create();
var system = require('system');

var url = '%APP_CLIENTHOST_EXPOSE%/app/%APP_NAME%';

// Show help if requested

if (system.args.indexOf('--help') !== -1) {
	console.log('Usage: ' + system.args[0] + ' <PATH>');
	console.log('');
	console.log('Where <PATH> is an optional suffix after "' + url + '"');
	phantom.exit(1);
}

// Otherwise complete the URL with a route

var path = system.args[1];

if (path) {
	if (path[0] !== '/') {
		url += '/';
	}

	url += path;
}

page.onConsoleMessage = function (msg) {
	console.log(msg);
};

page.onClosing = function (closingPage) {
	console.log('Application closed: ' + closingPage.url);
	phantom.exit();
};

page.open(url, function (status) {
	if (status !== 'success') {
		console.log('Could not load URL: ' + url);
		phantom.exit(1);
	}
});
