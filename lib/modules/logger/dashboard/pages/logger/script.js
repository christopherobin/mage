(function (window) {
	var mage = window.mage;
	var mod = mage.registerModule($html5client('module.logger.construct'));
	var logBox;
	var maxLength = 40;
	var websocket;
	var loggerOptions;
	var maxChannelLen = 0;

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


	function logMessage(message) {
		var data = JSON.parse(message.data);

		if (!data.channel) {
			return;
		}

		var timeStamp = new Date(data.timestamp);

		var dateElem = document.createElement('span');
		dateElem.setAttribute('class', 'date');

		dateElem.textContent = [
			data.pid,
			'-',
			makeMillisecondTimeString(timeStamp),
			new Array(maxChannelLen - data.channel.length + 1).join(' '),
			'<' + data.channel + '> '
		].join(' ');

		var messageElem = document.createElement('span');
		messageElem.setAttribute('class', data.channel);
		messageElem.textContent = '[' + data.contexts.join(' ') + '] ' + data.message;

		// Make a div to contain these.
		var container = document.createElement('div');
		container.appendChild(dateElem);
		container.appendChild(messageElem);

		function createBrick() {
			var brick = document.createElement('span');
			brick.setAttribute('class', 'brick');
			brick.textContent = ' ';
			return brick;
		}

		if (data.details) {
			for (var i = 0; i < data.details.length; i++) {
				container.appendChild(document.createElement('br'));
				container.appendChild(createBrick());

				var iline = document.createElement('span');
				iline.textContent = ' ' + data.details[i];
				container.appendChild(iline);
			}
		}

		if (data.data) {
			var stringified = JSON.stringify(data.data, null, '  ').split('\n');

			for (var j = 0; j < stringified.length; j++) {
				container.appendChild(document.createElement('br'));
				container.appendChild(createBrick());

				var jline = document.createElement('span');
				jline.textContent = ' ' + stringified[j];
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

	function logError(error) {
		console.error(error);
	}

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

	function makeSocket() {
		websocket = new WebSocket('ws://dev.wizcorp.jp:4211/logger');

		websocket.onmessage = logMessage;
		websocket.onopen = loggerChange;
		websocket.onerror = logError;
		websocket.onclose = function () {
			window.setTimeout(makeSocket, 500);
		};
	}

	function appendChannels(channels, loggerOptions) {
		for (var i = 0; i < channels.length; i++) {
			var channel = channels[i];
			var id = 'checkbox-' + channel;

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
		logBox = document.getElementById("logBox");
		loggerOptions = document.getElementById("loggerOptions");
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
