var mage = require('mage');
var mageLoader = require('loader');

mage.useModules(require, 'logger');

var notifications = mage.dashboard.ui.notifications;
var forms = mage.dashboard.ui.forms;

var checkboxes;
var logBox;
var maxBacklog = 500;
var websocket;
var loggerOptions;
var maxChannelLen = 0;


/**
 * When a logger checkbox is toggled, this function is called to send the
 * server the new logger channel options.
 */

function sendChannels() {
	if (websocket && checkboxes) {
		websocket.send(JSON.stringify(checkboxes.checked));
	}
}


/**
 * Creates the mage-page basic content for logger.
 *
 * @param {Object} page The mage page for the logger
 */

function buildPage(page) {
	var h1 = document.createElement('h1');
	h1.textContent = 'Logger';

	loggerOptions = document.createElement('form');
	logBox = document.createElement('samp');
	logBox.setAttribute('class', 'logBox');

	page.appendChild(h1);
	page.appendChild(loggerOptions);
	page.appendChild(logBox);
}


/**
 * Left-pad string "val" up to "length" length with character "char"
 *
 * @param {string} val    The string to pad
 * @param {number} length The length that "val" needs to become
 * @param {string} char   The character to be used as padding
 * @returns {string}      The padded string
 */

function lpad(val, length, char) {
	char = char || ' ';
	val = val + '';

	while (val.length < length) {
		val = char + val;
	}

	return val;
}


/**
 * Make a sensible timestring out of a date object, with consistent width in the local timezone.
 * Looks like: hh:mm:ss.xxx
 *
 * @param  {Date}   date A javascript date object.
 * @return {string}      A string containing the formatted time derived from the input date.
 */

function makeMillisecondTimeString(date) {

	// Make all times the same length with padding.

	var hour = lpad(date.getHours(), 2, '0');
	var minute = lpad(date.getMinutes(), 2, '0');
	var second = lpad(date.getSeconds(), 2, '0');
	var milliseconds = lpad(date.getMilliseconds(), 3, '0');

	return hour + ':' + minute + ':' + second + '.' + milliseconds;
}


/**
 * Adds an HTML element to the log output, and drops old log entries if maxBacklog has been breached
 *
 * @param {Element} elm The HTML element to be added
 */


function addLogEntry(elm) {
	// Insert the message as the top element.

	logBox.insertBefore(elm, logBox.firstChild);

	// Make sure we don't go above maxBacklog messages.

	while (logBox.childNodes.length > maxBacklog) {
		logBox.removeChild(logBox.lastChild);
	}
}


/**
 * Shows or hides a channel in the backlog
 *
 * @param {string} channel  The channel to show or hide
 * @param {boolean} visible True if the channel should be shown, false otherwise
 */

function toggleChannel(channel, visible) {
	var divs = logBox.querySelectorAll('div[data-channel=' + channel + ']');

	for (var i = 0, len = divs.length; i < len; i++) {
		divs[i].style.display = visible ? '' : 'none';
	}
}


/**
 * Renders a disconnection break
 */

function logDisconnect() {
	addLogEntry(document.createElement('hr'));
}

/**
 * Formats a message to look like Mage terminal output, and appends it to the logBox.
 *
 * @param {string} message A websocket message to be JSON parsed to a log entry
 */

function logMessage(message) {
	// Parse the message string

	var data = JSON.parse(message.data);

	// If the message isn't about logging, return.

	if (!data.channel) {
		return;
	}

	// Format a time stamp.

	var time = makeMillisecondTimeString(new Date(data.timestamp));

	// Create an element for the date and time stamp.

	var dateElem = document.createElement('span');
	dateElem.className = 'date';

	// Format the text of the date element.

	var channelStr = lpad('', maxChannelLen - data.channel.length) + '<' + data.channel + '>';

	dateElem.textContent = data.role + '-' + data.pid + ' - ' + time + ' ' + channelStr + ' ';

	// Create an element for the message content.

	var messageElem = document.createElement('span');
	messageElem.className = data.channel;
	messageElem.textContent = '[' + data.contexts.join(' ') + '] ' + data.message;

	// Make a div to contain the date and message elements.

	var container = document.createElement('div');
	container.setAttribute('data-channel', data.channel);
	container.appendChild(dateElem);
	container.appendChild(messageElem);

	// Details and Data

	var str = [];

	if (Array.isArray(data.details) && data.details.length > 0) {
		str.push(data.details.join('\n'));
	}

	if (data.data) {
		str.push(JSON.stringify(data.data, null, '  '));
	}

	if (str) {
		var block = document.createElement('div');
		block.className = 'details ' + data.channel;
		block.textContent = str.join('\n');
		container.appendChild(block);
	}

	addLogEntry(container);
}


var isConnected = false;

/**
 * Resolves the address of the logger websocket and creates a new connection.
 */

function makeSocket() {
	// Mutate the base URL protocol into ws:// and append the logger path.

	var baseUrl = mage.getSavvyBaseUrl();
	if (!baseUrl) {
		return notifications.send('Logger requires a Savvy base URL to be configured');
	}

	var address = baseUrl.replace(/^.*:\/\//, 'ws://') + '/logger';

	websocket = new WebSocket(address);

	websocket.onmessage = logMessage;

	websocket.onopen = function () {
		isConnected = true;

		sendChannels();
	};

	websocket.onerror = function () {
		notifications.send('Error while trying to connect to Savvy.');
	};

	websocket.onclose = function () {
		if (isConnected) {
			logDisconnect();
		}

		isConnected = false;

		window.setTimeout(makeSocket, 500);
	};
}


/**
 * Fills the logger options form with new channel checkboxes.
 *
 * @param  {string[]} channels An array of channel names
 */

function setChannels(channels) {
	maxChannelLen = channels.reduce(function (previousValue, currentValue) {
		return Math.max(previousValue, currentValue.length);
	}, 0);

	function onchange(channel, checked) {
		toggleChannel(channel, checked);
		sendChannels();
	}

	checkboxes = forms.checkboxes(channels, onchange, channels);

	loggerOptions.innerHTML = '';
	loggerOptions.appendChild(checkboxes.fragment);

	sendChannels();
}


mageLoader.once('logger.display', function (pageElm) {
	buildPage(pageElm);

	mage.logger.getAllChannelNames(function (error, channelList) {
		if (error) {
			return notifications.send('No channels could be returned.');
		}

		setChannels(channelList);
		makeSocket();
	});
});