var mage = require('../../mage');

var now, timer;

exports.now = function () {
	return now;
};


// no need to wait for a setup() call

function updateTime() {
	var currentTime = Date.now();

	now = (currentTime / 1000) >> 0;	// round down

	timer = setTimeout(updateTime, 1000 - (currentTime % 1000));
}

updateTime();

mage.once('shutdown', function () {
	clearTimeout(timer);
});
