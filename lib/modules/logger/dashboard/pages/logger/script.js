(function (window) {
	var mage = window.mage;
	var mod = mage.registerModule($html5client('module.logger.construct'));
	var logBox;
	var logContent = [];
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

		var displayedString = data.pid;
		displayedString += ' - ';
		displayedString += makeMillisecondTimeString(timeStamp);
		displayedString += ' &lt;';
		displayedString += data.channel;
		displayedString += '>';
		displayedString += new Array(maxChannelLen - data.channel.length + 1).join(' ');
		displayedString += ' [';
		displayedString += data.contexts.join(' ');
		displayedString += '] ';
		displayedString += data.message;

		// Add new data to the front.
		logContent.unshift(displayedString);

		// Drop everything but the latest maxLength entries.
		logContent = logContent.slice(0, maxLength);

		logBox.innerHTML = logContent.join('\n');
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
		websocket = new WebSocket('ws://dev.wizcorp.jp:4211/');

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

			var option = document.createElement('input');
			option.setAttribute('type', 'checkbox');
			option.setAttribute('value', channel);
			option.setAttribute('checked', true);
			option.setAttribute('class', 'regular-checkbox');

			var label = document.createElement('label');
			label.appendChild(option);
			label.appendChild(document.createTextNode(channel));

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
