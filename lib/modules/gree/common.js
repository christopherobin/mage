exports.encodeRfc3986 = function (str) {
	return encodeURIComponent(str).replace(/\!/g, '%21').replace(/\*/g, '%2A').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\'/g, '%27'); //.replace(/%2C/g, ',');	// gree doesn't like escaped commas
};

