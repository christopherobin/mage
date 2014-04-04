#!/usr/bin/env phantomjs

/*
 * This PhantomJS script allows you to easily run the "%APP_NAME%" app.
 * To do this simply run this file with optionally an extra path to append to the URL.
 *
 * This will then load up the page and run it.
 *
 * Usage:
 *      ./<THIS FILE> <PATH>
 *
 * Example:
 *      ./phantomloader /questbot
 *
 * NOTE: THIS IS NOT A NODEJS OR GAME FRONTEND FILE. OUR FRAMEWORK DOES NOT APPLY HERE
 *       PLEASE REFER TO PHANTOMJS DOCUMENTATION FOR MORE INFORMATION!
 *
 *       http://phantomjs.org
 *       https://github.com/ariya/phantomjs/wiki
 */

var defaultUrl = '%APP_CLIENTHOST_EXPOSE%' || 'http://localhost';
var defaultPath = '/app/%APP_NAME%';


console.log('PhantomJS loader for MAGE app: %APP_NAME%');
console.log('');

var page = require('webpage').create();
var system = require('system');


function getArg(name) {
	var args = system.args;
	var index = args.indexOf(name, 1);
	if (index === -1) {
		return;
	}

	var next = args[index + 1];
	if (!next || next[0] === '-') {
		// there's no next argument, or the next arg is a flag, so ignore it

		return true;
	}

	return next;
}


// Show help if requested

if (getArg('--help')) {
	console.log('Usage: ' + system.args[0] + ' <options>');
	console.log('');
	console.log('Where <options> is:');
	console.log('  --help         Prints this information');
	console.log('  --url <URL>    A full URL to run with PhantomJS (default: ' + defaultUrl + ')');
	console.log('  --path <PATH>  A path at the given URL (optional, default: ' + defaultPath + ')');
	console.log('');

	phantom.exit(1);
}


// Get the URL and path value

var url = getArg('--url');

if (typeof url !== 'string') {
	url = defaultUrl;
}

var path = getArg('--path');
if (typeof path !== 'string') {
	path = defaultPath;
}

// Append the path to the URL

while (url.slice(-1) === '/') {
	url = url.slice(0, -1);
}

if (path[0] === '/') {
	url += path;
} else {
	url += '/' + path;
}


page.onConsoleMessage = function (msg) {
	console.log(msg);
};

page.onError = function (msg, trace) {
	var msgStack = ['ERROR: ' + msg];

	if (trace && trace.length) {
		msgStack.push('TRACE:');

		trace.forEach(function (t) {
			msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
		});
	}

	console.error(msgStack.join('\n'));
};

page.onClosing = function (closingPage) {
	console.log('Application closed:', closingPage.url);
	phantom.exit();
};

console.log('Loading', url);

page.open(url, function (status) {
	if (status === 'success') {
		console.log('Finished loading:', url, '(title: ' + page.title + ')');
	} else {
		console.log('Could not load:', url);
		phantom.exit(1);
	}
});
