(function (window) {
	var mage = window.mage;
	var mod = mage.registerModule($html5client('module.logger.construct'));
	var select;

	function logMessage(message) {
		console.log(message);
	}

	function logOpen() {
		console.log('Socket opened.');
	}

	function logError(error) {
		console.log(error);
	}


	function appendChannels(channels, select) {
		for (var i = 0; i < channels.length; i++) {
			var channel = channels[i];
			var option = document.createElement('option');
			option.text = channel;
			option.value = channel;
			select.appendChild(option);
		}
	}

	mage.loader.once('logger.display', function () {
		select = document.getElementById("loggerOptionBox");

		mod.getAllChannelNames(function (error, channelList) {
			if (error) {
				return console.error('No channels could be returned.', error);
			}

			appendChannels(channelList, select);
			var websocket;

			function makeSocket() {
				websocket = new WebSocket('ws://dev.wizcorp.jp:12391');

				websocket.onmessage = logMessage;
				websocket.onopen = logOpen;
				websocket.onerror = logError;
				websocket.onclose = makeSocket;
			}

			makeSocket();

			console.log(websocket);
/*
			select.onchange = function () {
				var selectedValue = select.options[select.selectedIndex].value;
			};
*/
		});
	});
}(window));
