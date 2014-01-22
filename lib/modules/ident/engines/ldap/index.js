var requirePeer = require('codependency').get('mage');
var ldap = requirePeer('ldapjs');
var util = require('util');
var assert = require('assert');
var Engine = require('../engine').Engine;


function Ldap(name, cfg, logger) {
	assert.ok(cfg, 'No configuration given.');
	assert.ok(cfg.url, 'No URL configured.');
	assert.equal(typeof cfg.url, 'string', 'The URL must be a string.');
	assert.ok(cfg.baseDn, 'No baseDn configured.');
	assert.equal(typeof cfg.baseDn, 'string', 'The baseDn must be a string.');

	this.name = name;
	this.cfg = cfg;
	this.logger = logger;
}

util.inherits(Ldap, Engine);

/**
 * Distinguished Names (DNs) escaping according to IBM spec
 *
 * @link http://publib.boulder.ibm.com/infocenter/iseries/v5r3/index.jsp?topic=%2Frzahy%2Frzahyunderdn.htm
 * @param {string} str The DN to escape
 * @returns {string}
 */
function dnEscape(str) {
	return str.replace(/([\\,=\+<>#;"])/g, '\\$1');
}


Ldap.prototype.auth = function (state, credentials, cb) {
	var username = credentials.username;
	var password = credentials.password;

	assert.ok(username, 'No username given');
	assert.ok(password, 'No password given');
	assert.equal(typeof username, 'string', 'Username is not a string');
	assert.equal(typeof password, 'string', 'Password is not a string');

	// we need to create a client every time

	this.logger.debug('Connecting to', this.cfg.url);

	var client;

	try {
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

		var user = {
			userId: dn,
			displayName: username,
			data: {},
			// add username, as its no secret:
			username: username
		};

		cb(null, user);
	});
};


/**
 * Setup function for ldap engine for the ident module
 *
 * @param {object} cfg - Configuration for ident module
 * @param {object} logger - Mage logger
 * @param {function} cb - Callback function
 */
exports.setup = function (name, cfg, logger, cb) {
	var instance;

	try {
		instance = new Ldap(name, cfg, logger);
	} catch (err) {
		return cb(err);
	}

	cb(null, instance);
};
