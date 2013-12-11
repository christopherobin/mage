var util = require('util');
var Engine = require('../engine').Engine;
var ldap;

function LdapEngine(cfg, logger) {
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


LdapEngine.prototype.auth = function (state, credentials, cb) {
	var username = credentials.username;
	var password = credentials.password;

	// we need to create a client every time
	var client;

	try {
		this.logger.debug('Connecting to ' + this.cfg.url);
		client = ldap.createClient({ url: this.cfg.url, connectTimeout: 10000 });
	} catch (error) {
		return state.error('ident', error, cb);
	}

	// identify on the network

	var uidAttr = this.cfg.uidAttr || 'uid';
	var dn = uidAttr + '=' + dnEscape(username) + ',' + this.cfg.baseDn;

	client.bind(dn, password, function (error) {
		if (error) {
			return state.error('ident', error.message, cb);
		}

		// disconnect

		client.unbind();

		cb(null, dn, { username: username });
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
