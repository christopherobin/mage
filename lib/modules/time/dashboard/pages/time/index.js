var mage = require('mage.js');
var moment = require('moment');

var pkg = require('mage-loader.js').getPackage('time');
pkg.addHtml(require('./page.html'));
pkg.injectHtml();

mage.useModules(require, 'time');


function Clock(name) {
	var div = this.div = document.createElement('DIV');
	div.style.textAlign = 'center';
	div.style.color = '#777';
	div.style.fontFamily = 'sans-serif';
	div.style.fontSize = '50px';
	div.style.lineHeight = '80px';

	var label = document.createElement('SPAN');
	label.textContent = name + ': ';

	div.appendChild(label);

	this.time = document.createElement('SPAN');
	div.appendChild(this.time);
}

Clock.prototype.update = function (timestamp) {
	this.time.textContent = moment(timestamp).format('ddd MMM D, YYYY h:mm:ss a');
};


var mageClock = new Clock('MAGE');
var realClock = new Clock('Real');


pkg.once('show', function () {
	var timeClock = document.getElementById('timeClock');

	var frm = document.getElementById('frmTimeBend');
	frm.onsubmit = function () {
		resync();
		return false;
	};

	function resync() {
		var offset = parseInt(frm.elements.offset.value * frm.elements.offsetUnit.value * 1000, 10);
		var acceleration = parseFloat(frm.elements.acceleration.value);

		mage.time.bend(offset, acceleration, null, function (error) {
			if (error) {
				return console.error(error);
			}

			mage.time.synchronize(function (error) {
				if (error) {
					return console.error(error);
				}
			});
		});
	}

	timeClock.appendChild(mageClock.div);
	timeClock.appendChild(realClock.div);
});

var keepTicking;

function updateClocks() {
	mageClock.update(mage.time.server.now(true));
	realClock.update(Date.now());

	if (keepTicking) {
		window.requestAnimationFrame(updateClocks);
	}
}

pkg.on('show', function () {
	keepTicking = true;
	updateClocks();
});

pkg.on('hide', function () {
	keepTicking = false;
});
