var mage = require('mage');
var mageLoader = require('loader');

mage.useModules(require, 'logger');

var notifications = mage.dashboard.ui.notifications;
var forms = mage.dashboard.ui.forms;

var checkboxes;
var logBox;
var maxBacklog = 40;
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
 * Make a sensible timestring out of a date object, with consistent width in the local timezone.
 * Looks like: hh:mm:ss.xxx
 *
 * @param  {Date}   date A javascript date object.
 * @return {string}      A string containing the formatted time derived from the input date.
 */

function makeMillisecondTimeString(date) {

	// Make all times the same length with padding.

	function pad(val, length) {
		val = val + '';

		while (val.length < length) {
			val = '0' + val;
		}

		return val;
	}

	var hour = pad(date.getHours(), 2);
	var minute = pad(date.getMinutes(), 2);
	var second = pad(date.getSeconds(), 2);
	var milliseconds = pad(date.getMilliseconds(), 3);

	return hour + ':' + minute + ':' + second + '.' + milliseconds;
}


/**
 * Formats a message to look like Mage terminal output, and appends it to the logBox. When the
 * number of messages is above a preset length, only length or the most recent messages are
 * shown.
 *
 * @param {Object} message [description]
 */

function logMessage(message) {
	var data = JSON.parse(message.data);

	// If the message isn't about logging, return.
	if (!data.channel) {
		return;
	}

	// Format a time stamp.
	var timeStamp = new Date(data.timestamp);

	// Create an element for the date and time stamp.
	var dateElem = document.createElement('span');
	dateElem.setAttribute('class', 'date');

	// Format the text of the date element.
	dateElem.textContent = [
		data.pid,
		'-',
		makeMillisecondTimeString(timeStamp) + new Array(maxChannelLen - data.channel.length + 1).join(' '),
		'<' + data.channel + '> '
	].join(' ');

	// Create an element for the message content.
	var messageElem = document.createElement('span');
	messageElem.setAttribute('class', data.channel);
	messageElem.textContent = '[' + data.contexts.join(' ') + '] ' + data.message;

	// Make a div to contain the date and message elements.
	var container = document.createElement('div');
	container.appendChild(dateElem);
	container.appendChild(messageElem);


	/**
	 * Makes a new brick element.
	 *
	 * When a message includes data, it gets indented with a coloured bar. At present this bar
	 * is constructed of 'bricks', much like in the terminal. In the future this is likely to be
	 * achieved using a border instead.
	 *
	 * @return {Object} An HTML element containing a brick.
	 */

	function createBrick() {
		var brick = document.createElement('span');
		brick.setAttribute('class', data.channel + '-brick');
		brick.textContent = ' ';
		return brick;
	}

	var detailedText = data.details;
	var detailedData = data.data;

	// If the message has some additional details, format and add them to the container.
	if (detailedText) {
		for (var i = 0; i < detailedText.length; i++) {
			container.appendChild(document.createElement('br'));
			container.appendChild(createBrick());

			var iline = document.createElement('span');
			iline.setAttribute('class', data.channel + '-details');
			iline.textContent = ' ' + detailedText[i];
			container.appendChild(iline);
		}
	}

	// If the message had some data, format it here and add to the container.
	if (detailedData) {
		var stringified = JSON.stringify(detailedData, null, '  ').split('\n');

		for (var j = 0; j < stringified.length; j++) {
			container.appendChild(document.createElement('br'));
			container.appendChild(createBrick());

			var jline = document.createElement('span');
			jline.textContent = (j === 0 ? ' data: ' : ' ') + stringified[j];
			jline.setAttribute('class', data.channel + '-details');
			container.appendChild(jline);
		}
	}

	// Insert the message as the top element.
	logBox.insertBefore(container, logBox.firstChild);

	// Make sure we don't go above maxBacklog messages.
	while (logBox.childNodes.length > maxBacklog) {
		logBox.removeChild(logBox.lastChild);
	}
}


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
	websocket.onopen = sendChannels;

	websocket.onerror = function () {
		notifications.send('Error while trying to connect to Savvy.');
	};

	websocket.onclose = function () {
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

	checkboxes = forms.checkboxes(channels, sendChannels, channels);

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