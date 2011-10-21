var clients = ['html5'];


exports.getPath = function (clientName) {
	if (clients.indexOf(clientName) !== -1) {
		return __dirname + '/' + clientName;
	}

	return null;
};

