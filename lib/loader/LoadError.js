var inherits = require('inherit');


function LoadError(message, response, errorObj) {
	Error.call(this);

	this.message = message;      // human readable
	this.response = response;    // (optional) HTTP response
	this.error = errorObj;       // (optional) error object that caused this
	this.isRetrying = false;     // true if Loader is retrying and no human intervention is needed
	this.packageName = null;     // error happened while loading this package
}

inherits(LoadError, Error);


module.exports = LoadError;
