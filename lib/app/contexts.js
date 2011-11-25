var mithril = require('../mithril');


var contexts = {};
var fileExtensions = {};


function FileContext(name, mimetype, fileGlue) {
	this.name = name;
	this.mimetype = mimetype;
	this.fileGlue = fileGlue;
	this.ext = [];
	this.parsers = {};	// ext: fn
	this.postProcessors = {};	// name: fn
}


FileContext.prototype.addFileExtensions = function (extensions, parser) {
	for (var i = 0, len = extensions.length; i < len; i++) {
		var ext = extensions[i];

		this.ext.push(ext);

		if (fileExtensions.hasOwnProperty(ext)) {
			mithril.core.logger.error('Warning, overwriting previously assigned file extension:', ext);
		}

		fileExtensions[ext] = this;

		if (parser) {
			this.parsers[ext] = parser;
		}
	}

	return this;
};


FileContext.prototype.addParser = function (ext, fnParser) {
	this.parsers[ext] = fnParser;
	return this;
};


FileContext.prototype.getParser = function (ext) {
	return this.parsers[ext] || null;
};


FileContext.prototype.addPostProcessor = function (name, postProcessor) {
	this.postProcessors[name] = postProcessor;
	return this;
};


exports.add = function (contextName, mimetype, fileGlue) {
	var context = new FileContext(contextName, mimetype, fileGlue);
	contexts[contextName] = context;
	return context;
};


exports.get = function (contextName) {
	return contexts[contextName] || null;
};


exports.getForFileExtension = function (ext) {
	return fileExtensions[ext] || null;
};

