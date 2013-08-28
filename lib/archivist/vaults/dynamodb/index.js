var Archive = require('./Archive');

exports.defaultTopicApi = require('./defaultTopicApi');

/**
 * Creates a new DynamoDB vault
 *
 * @param name
 * @param logger
 * @constructor
 */
function DynamoDbVault(name, logger) {
	this.name = name;
	this.logger = logger;
	this.archive = new Archive(this);  // archivist bindings

	this.dynamodb = null;
}

/**
 * Factory function to create a DynamoDbVault
 *
 * @param {string}     name   The name of the vault
 * @param {LogCreator} logger A logger instance
 * @returns {DynamoDbVault}
 */
exports.create = function (name, logger) {
	return new DynamoDbVault(name, logger);
};

/**
 * Setups the vault
 *
 * @param {Object}   cfg                 The configuration object
 * @param {string}   cfg.accessKeyId     The access key provided by Amazon
 * @param {string}   cfg.secretAccessKey The secret key provided by Amazon
 * @param {string}   cfg.region          The AWS region you which to connect to
 * @param {Function} cb
 * @returns {*}
 */
DynamoDbVault.prototype.setup = function (cfg, cb) {
	var aws;

	try {
		aws = require('aws-sdk');
	} catch (error) {
		this.logger.emergency('Could not load aws-sdk. Make sure your npm modules are up to date.');
		return cb(error);
	}

	// config aws
	aws.config.update(cfg);

	// then instanciate the DynamoDB object, this apiVersion is the one we used to write the service
	// please change it when updating to newer versions
	this.dynamodb = new aws.DynamoDB({ apiVersion: '2012-08-10' });

	// no async stuff, we can return asap
	cb();
};

DynamoDbVault.prototype.close = function () {
	// do nothing
};

/**
 * Get data from DynamoDB
 *
 * @param {string}   table      The table we want to query
 * @param {Object}   index      An object that represents the index we want to get, see the format in the DynamoDB doc
 *                              for getItem
 * @param {boolean}  consistent Whether we want the get operation to be consistent, will make the query slower
 * @param {Function} cb         A callback that will be called with an error and the data
 *
 * @link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB_20120810.html#getItem-property
 */
DynamoDbVault.prototype.get = function (table, index, consistent, cb) {
	this.logger.verbose.data(table, index, consistent).log('Getting data from table', table);

	var params = {
		TableName: table,
		Key: index
	};

	this.dynamodb.getItem(params, cb);
};

/**
 * Put data on DynamoDB
 *
 * @param {string}   table     The table where we want to add/update data
 * @param {Object}   data      The data we want to insert, uses the DynamoDB structured format, see link below
 * @param {Object}   [expects] Expected conditions to perform the insertion
 * @param {Function} cb        A callback called with an error if one happened
 *
 * @link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB_20120810.html#putItem-property
 */
DynamoDbVault.prototype.put = function (table, data, expects, cb) {
	this.logger.verbose.data(table, data).log('Storing data on table', table);

	var params = {
		TableName: table,
		Item: data
	};

	// expects is optional
	if (expects instanceof Function) {
		cb = expects;
	} else {
		params.Expected = expects;
	}

	// put the item
	this.dynamodb.putItem(params, cb);
};

/**
 * Delete data from DynamoDB
 *
 * @param {string}   table     The table where we want to delete data
 * @param {Object}   index     The primary key to delete, uses the DynamoDB structured format
 * @param {Object}   [expects] Expected conditions to perform the insertion
 * @param {Function} cb        A callback called with an error if one happened
 */
DynamoDbVault.prototype.del = function (table, index, expects, cb) {
	this.logger.verbose.data(table, index).log('Deleting data on table', table);

	var params = {
		TableName: table,
		Key: index
	};

	// expects is optional
	if (expects instanceof Function) {
		cb = expects;
	} else {
		params.Expected = expects;
	}

	// delete the item
	this.dynamodb.deleteItem(params, cb);
};