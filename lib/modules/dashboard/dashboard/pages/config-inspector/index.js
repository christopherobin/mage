var mage = require('mage');
var escapeHtml = require('escape-html');

var ui = mage.dashboard.ui;


var elmInspector = document.getElementById('configInspector');


function Color(r, g, b) {
	function truncate(n) {
		if (n < 0) {
			return 0;
		}

		if (n > 255) {
			return 255;
		}

		return parseInt(n, 10);
	}

	this.r = truncate(r);
	this.g = truncate(g);
	this.b = truncate(b);
}


Color.prototype.brightness = function (perc) {
	return new Color(this.r * perc, this.g * perc, this.b * perc);
};


Color.prototype.toString = function () {
	return 'rgb(' + this.r + ', ' + this.g + ', ' + this.b + ')';
};


mage.dashboard.getConfig(function (error, config) {
	if (error) {
		return ui.notifications.send('Error fetching configuration');
	}


	var baseColors = [
		new Color(0xCC, 0xCC, 0xCC)
	];

	var currentBaseColor = -1;

	function getCurrentBaseColor() {
		return baseColors[currentBaseColor];
	}

	function getNextBaseColor() {
		currentBaseColor += 1;
		if (currentBaseColor >= baseColors.length) {
			currentBaseColor = 0;
		}

		return baseColors[currentBaseColor];
	}


	function makeLine(str, src, indentLevel) {
		str = escapeHtml(str);
		src = escapeHtml(src.replace(config.rootPath, '.'));

		var sourceSpan = '<span style="float: right;">' + src + '</span>';

		var color = indentLevel === 0 ? getNextBaseColor() : getCurrentBaseColor().brightness(1 + indentLevel / 15);
		var style = 'background-color: ' + color + '; padding-left: ' + (indentLevel * 40) + 'px;';

		return '<div style="' + style + '">' + str + sourceSpan + '</div>\n';
	}


	function stringifyObjectMatryoshka(matryoshka, indentLevel) {
		var value = matryoshka.value;

		var keys = Object.keys(value).sort();
		var out = '';

		for (var i = 0; i < keys.length; i += 1) {
			var key = keys[i];
			var child = value[key];

			if (child.type === 'scalar' || Object.keys(child.value).length === 0) {
				out += makeLine(key + ': ' + JSON.stringify(child.value), child.source, indentLevel);
			} else {
				out += makeLine(key + ':', child.source, indentLevel);
				out += stringifyObjectMatryoshka(child, indentLevel + 1);
			}
		}

		return out;
	}


	elmInspector.innerHTML = stringifyObjectMatryoshka(config.matryoshka, 0);
});
