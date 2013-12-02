var mage = require('../../../../mage');
var ldap;
var util = require('util');
var Engine = require('../engine').Engine;

function LdapEngine(cfg, logger) {
	// do nothing
	this.cfg = cfg;
	this.logger = logger;
}

util.inherits(LdapEngine, Engine);

/**
 * Distinguished Names (DNs) escaping according to IBM spec
 *
 * @link http://publib.boulder.ibm.com/infocenter/iseries/v5r3/index.jsp?topic=%2Frzahy%2Frzahyunderdn.htm
 * @param {string} string The DN to escape
 * @returns {string}
 */
function dnEscape(string) {
	return string.replace(/([\\,=\+<>#;"])/g, '\\$1');
}

// do the actual authentication
LdapEngine.prototype.auth = function (state, params, cb) {
	var that = this;

	// we need to create a client every time
	var client;

	try {
		this.logger.debug('Connecting to ' + this.cfg.url);
		client = ldap.createClient({ url: this.cfg.url, connectTimeout: 10000 });
	} catch (err) {
		return cb(err);
	}

	// this bit here is how you identify on the network
	var uidAttr = this.cfg.uidAttr || "uid";
	var dn = uidAttr + '=' + dnEscape(params.username) + ',' + this.cfg.baseDn;

	client.bind(dn, params.password, function (err) {
		if (err) {
			return cb(new Error(err.message));
		}

		// disconnect and register session
		client.unbind();
		mage.session.register(state, dn, null, { access: that.cfg.access }, cb);
	});
};

/**
 * Setup function for ldap engine for the ident module
 *
 * @param {object} cfg - Configuration for ident module
 * @param {object} logger - Mage logger
 * @param {function} cb - Callback function
 */
exports.setup = function (cfg, logger, cb) {
	var instance;

	if (!ldap) {
		try {
			ldap = require('ldapjs');
		} catch (err) {
			return cb(new Error('Please install the optional dependency "ldapjs" to use this engine'));
		}
	}

	try {
		instance = new LdapEngine(cfg, logger);
	} catch (err) {
		return cb(err);
	}

	cb(null, instance);
};
