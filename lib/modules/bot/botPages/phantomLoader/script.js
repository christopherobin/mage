/*
 * This loader allows you to easily run a mage bot using PhantomJS. This will
 * allow you to run headless bots without the need for a browser. To do this
 * simply download this page as a js file and run it using phantomjs binary with
 * the argument of the bot name you wish to run.
 *
 * This will then execute the route /app/bot/<BOT NAME>
 *
 *
 * Usage:
 *      ./bin/phantomjs phantom.js <PRE SHARED KEY> <BOT NAME>
 *
 * Example:
 *      curl -s http://deadrising.ak.node.wizcorp.jp/app/bot/phantom | gunzip > phantom.js;
 *      ./bin/phantomjs phantom.js autoQuest
 */


var page = require('webpage').create();
var system = require('system');


// Function which returns base URL
function getClientHostBaseUrl() {
	var host = $cfg('server.clientHost.expose.host');
	var port = $cfg('server.clientHost.expose.port') || 80;

	return 'http://' + host + ':' + port;
}


// Exit if no bot page name argument
if (system.args.length !== 3) {
	console.log('Usage: ' + system.args[0] + ' <PRE SHARED KEY> <BOT NAME>');
	phantom.exit(1);
}


// Otherwise Setup Bot Page
var url = getClientHostBaseUrl() + '/app/bot/' + system.args[2] + '#psk=' + system.args[1];

page.onConsoleMessage = function (msg) {
	console.log(msg);
};

page.onClosing = function (closingPage) {
	console.log('Bot Ended: ' + closingPage.url);
	phantom.exit();
};

page.open(url, function (status) {
	if (status !== 'success') {
		console.log('Could not load URL: ' + url);
		phantom.exit(1);
	}
});