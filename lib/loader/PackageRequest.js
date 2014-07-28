/**
 * Constructor for a PackageRequest. This represents the fact that we are looking for a package
 * with a particular name and client configuration.
 *
 * @param packageName
 * @param language
 * @param density
 * @constructor
 */

function PackageRequest(appName, packageName, language, screen, density) {
	if (!appName || typeof appName !== 'string') {
		throw new TypeError('A PackageRequest needs an appName (string)');
	}

	if (!packageName || typeof packageName !== 'string') {
		throw new TypeError('A PackageRequest needs a packageName (string)');
	}

	if (!language || typeof language !== 'string') {
		throw new Error('A PackageRequest needs a language (string)');
	}

	if (!screen || typeof screen !== 'string') {
		throw new Error('A PackageRequest needs a screen resolution (string)');
	}

	if (!density || typeof density !== 'number') {
		throw new Error('A PackageRequest needs a pixel density (string)');
	}

	this.appName = appName;
	this.packageName = packageName;
	this.language = language;
	this.screen = screen;
	this.density = density;
}

module.exports = PackageRequest;


PackageRequest.prototype.toString = function () {
	// TODO: Because of how volatile screen resolution may behave, for now we don't make this part
	// TODO: of the unique representation of a package. What we SHOULD be doing however is snap to
	// TODO: the right available resolution as supported by the app.

	return this.appName + '/' + this.packageName + '/' + this.language + '/' + this.density;
};
