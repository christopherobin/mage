exports.parse = function (str) {
	if (typeof str !== 'string') {
		return;
	}

	var result = {
		type: str,
		encoding: 'utf-8'
	};

	str = str.split(';');
	if (str.length === 2) {
		result.type = str[0].trim();
		result.encoding = str[1].trim();
	}

	return result;
};
