var mage = require('mage');
var mageLoader = require('loader');

var page = mageLoader.renderPage('time');
page.innerHTML = require('./page.html');

mage.useModules(require, 'time');


function Clock(label) {
	this.label = label;

	var div = this.div = document.createElement('div');
	div.style.textAlign = 'center';
	div.style.color = '#777';
	div.style.fontFamily = 'sans-serif';
	div.style.fontSize = '50px';
	div.style.lineHeight = '80px';
}


function pad(n, len) {
	n = '' + n;

	while (n.length < len) {
		n = '0' + n;
	}

	return n;
}

Clock.prototype.set = function (timestamp) {
	var date = new Date(timestamp);
	var time = date.getHours() + ':' + pad(date.getMinutes(), 2) + ':' + pad(date.getSeconds(), 2);

	this.div.textContent = this.label + ': ' + time;
};


var serverClock = new Clock('Server');
var clientClock = new Clock('Client');


mageLoader.once('time.display', function () {
	var timeClock = document.getElementById('timeClock');

	var frm = document.getElementById('frmTimeBend');
	frm.onsubmit = function () {
		return false;
	};

	var offsetDisplay = document.createElement('div');
	offsetDisplay.style.textAlign = 'center';
	offsetDisplay.style.fontFamily = 'sans-serif';
	offsetDisplay.style.fontSize = '20px';
	offsetDisplay.style.lineHeight = '40px';

	function resync() {
		var offset = parseInt(frm.elements.offset.value * frm.elements.offsetUnit.value * 1000, 10);
		var acceleration = parseFloat(frm.elements.acceleration.value);

		mage.time.bend(offset, acceleration, null);

		mage.time.synchronize(function (error) {
			if (error) {
				return;
			}

			var delta = mage.time.getOffset();
			var sec = Math.abs(delta / 1000);

			if (delta < 0) {
				// server is ahead

				offsetDisplay.textContent = 'the server is ahead of this client by ' + sec + ' sec';
			} else if (delta > 0) {
				// client is ahead

				offsetDisplay.textContent = 'this client is ahead of the server by ' + sec + ' sec';
			} else {
				// exactly equal to the millisecond

				offsetDisplay.textContent = 'client and server are perfectly synchronized';
			}
		});

		offsetDisplay.textContent = 'synchronizing with server...';
	}

	resync();

	frm.elements.offset.onchange = resync;
	frm.elements.offsetUnit.onchange = resync;
	frm.elements.acceleration.onchange = resync;

	timeClock.appendChild(serverClock.div);
	timeClock.appendChild(clientClock.div);
	timeClock.appendChild(offsetDisplay);
});


var timer;

mageLoader.on('time.display', function () {
	timer = window.setInterval(function () {
		clientClock.set(mage.time.client.now(true));
		serverClock.set(mage.time.server.now(true));
	}, 100);
});

mageLoader.on('time.close', function () {
	window.clearInterval(timer);
	timer = null;
});
