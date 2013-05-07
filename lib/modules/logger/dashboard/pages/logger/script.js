(function (window) {
	var mage = window.mage;
	var mod = mage.registerModule($html5client('module.logger.construct'));
	var logBox;
	var maxLength = 40;
	var websocket;
	var loggerOptions;
	var maxChannelLen = 0;
	var workspace;


	/**
	 * Creates the mage-page basic content for logger.
	 */

	function buildPage() {
		var pages = document.getElementsByClassName('mage-page');

		for (var i = 0; i < pages.length; i++) {
			var page = pages[i];

			if (page.getAttribute('data-page') === 'logger') {
				workspace = page;
				break;
			}
		}

		if (!workspace) {
			throw new Error('No logger page found.');
		}

		var h1 = document.createElement('h1');
		h1.innerText = 'Logger';

		var h2 = document.createElement('h2');
		h2.innerText = 'Mage Logger Service';

		loggerOptions = document.createElement('form');
		logBox = document.createElement('samp');
		logBox.setAttribute('class', 'logBox');

		workspace.appendChild(h1);
		workspace.appendChild(h2);
		workspace.appendChild(loggerOptions);
		workspace.appendChild(logBox);
	}


	/**
	 * Make a sensible timestring out of a date object, with consistent width in the local timezone.
	 * Looks like: hh:mm:ss.xxx
	 * 
	 * @param  {Date}   date A javascript date object.
	 * @return {String}      A string containing the formatted time derived from the input date.
	 */

	function makeMillisecondTimeString(date) {
		// Make all times the same length with padding.
		function pad(val, length) {
			var stringVal = '' + val;
			var numToAdd = length - stringVal.length;

			return new Array(numToAdd + 1).join('0') + stringVal;
		}

		var hour = pad((date.getUTCHours() + 24 - date.getTimezoneOffset() / 60) % 24, 2);
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

		// Make sure we don't go above maxLength messages.
		while (logBox.childNodes.length > maxLength) {
			logBox.removeChild(logBox.lastChild);
		}
	}


	/**
	 * Send websocket client errors to `console.error`.
	 *
	 * @param  {Object} error Websocket client error object.
	 */

	function logError(error) {
		console.error(error);
	}

	/**
	 * When a logger checkbox is toggled, this function is called to send the
	 * server the new logger channel options.
	 *
	 * @return {[type]} [description]
	 */

	function loggerChange() {
		var switchedOn = [];

		for (var i = 0; i < loggerOptions.length; i++) {
			var checkbox = loggerOptions[i];

			if (checkbox.checked) {
				switchedOn.push(checkbox.value);
			}
		}

		websocket.send(JSON.stringify(switchedOn));
	}


	/**
	 * Resolves the address of the logger websocket and creates a new connection.
	 */

	function makeSocket() {
		// Mutate the base URL protocol into ws:// and append the logger path.
		var address = mage.getSavvyBaseUrl().replace(/^.*:\/\//, 'ws://') + '/logger';

		websocket = new WebSocket(address);

		websocket.onmessage = logMessage;
		websocket.onopen = loggerChange;
		websocket.onerror = logError;
		websocket.onclose = function () {
			window.setTimeout(makeSocket, 500);
		};
	}


	/**
	 * Fills the logger options form with new channel checkboxes.
	 *
	 * @param  {String[]} channels      An array of channel names,
	 * @param  {Object}   loggerOptions A form element.
	 */

	function appendChannels(channels, loggerOptions) {
		for (var i = 0; i < channels.length; i++) {
			var channel = channels[i];
			var id = 'logger-checkbox-' + channel;

			var option = document.createElement('input');
			option.setAttribute('type', 'checkbox');
			option.setAttribute('value', channel);
			option.setAttribute('id', id);
			option.setAttribute('checked', true);

			var label = document.createElement('label');
			label.setAttribute('for', id);
			label.textContent = channel;

			loggerOptions.appendChild(option);
			loggerOptions.appendChild(label);

			// Update the maximum channel length. This is used for alignment.
			if (channel.length > maxChannelLen) {
				maxChannelLen = channel.length;
			}
		}
	}

	mage.loader.once('logger.display', function () {
		buildPage();
		loggerOptions.onchange = loggerChange;

		mod.getAllChannelNames(function (error, channelList) {
			if (error) {
				return console.error('No channels could be returned.', error);
			}

			appendChannels(channelList, loggerOptions);
			makeSocket();
		});
	});
}(window));
