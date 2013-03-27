/* jshint unused: false */

function xstr() {
	var n = arguments.length;

	var str = arguments[0];
	for (var i = 1; i < n; i++) {
		str = str.replace('$' + i, arguments[i]);
	}
	return str;
}
