var mage = require('mage');
var mageLoader = require('loader');

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


mageLoader.once('time.display', function (pageElm) {
	var offset = document.createElement('div');
	offset.style.textAlign = 'center';
	offset.style.fontFamily = 'sans-serif';
	offset.style.fontSize = '20px';
	offset.style.lineHeight = '40px';
	offset.textContent = 'synchronizing with server...';

	mage.setupModules(['time'], function () {
		var diff = mage.time.getOffset();
		var sec = diff / 1000;

		if (diff > 0) {
			// server is ahead

			offset.textContent = 'server is ahead of this client by ' + sec + ' sec';
		} else if (diff < 0) {
			// client is ahead

			offset.textContent = 'this client is ahead of server by ' + Math.abs(sec) + ' sec';
		} else {
			// exactly equal to the millisecond

			offset.textContent = 'client and server are perfectly synchronized';
		}
	});

	pageElm.appendChild(serverClock.div);
	pageElm.appendChild(clientClock.div);
	pageElm.appendChild(offset);
});


var timer;

mageLoader.on('time.display', function () {
	timer = window.setInterval(function () {
		clientClock.set(mage.time.getClientTime(true));
		serverClock.set(mage.time.getServerTime(true));
	}, 100);
});

mageLoader.on('time.close', function () {
	window.clearInterval(timer);
	timer = null;
});
