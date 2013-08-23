var mage = require('../mage');
var semver = require('semver');
var async = require('async');
var fs = require('fs');
var extname = require('path').extname;
var basename = require('path').basename;
var pathJoin = require('path').join;
var configuration = require('./configuration');
var logger = mage.core.logger.context('migration');


function loadMigrationFile(vault, version) {
	var migratorPath = pathJoin(configuration.getMigrationsPath(vault.name), version);

	return require(migratorPath);
}


function migrateUp(vault, versions, cb) {
	if (typeof vault.registerMigration !== 'function') {
		return cb(new Error('Cannot migrate up on vault ' + vault.name));
	}

	async.eachSeries(
		versions,
		function (version, callback) {
			logger.notice('Migrating', vault.name, 'vault to', version);

			var migrator;

			try {
				migrator = loadMigrationFile(vault, version);
			} catch (error) {
				return callback(error);
			}

			migrator.up(vault, function (error, report) {
				if (error) {
					return callback(error);
				}

				vault.registerMigration(version, report, callback);
			});
		},
		cb
	);
}


function migrateDown(vault, versions, cb) {
	if (typeof vault.unregisterMigration !== 'function') {
		return cb(new Error('Cannot migrate down on vault ' + vault.name));
	}

	async.eachSeries(
		versions,
		function (version, callback) {
			logger.notice('Migrating', vault.name, 'vault down from', version);

			var migrator;

			try {
				migrator = loadMigrationFile(vault, version);
			} catch (error) {
				return callback(error);
			}

			migrator.down(vault, function (error) {
				if (error) {
					return callback(error);
				}

				vault.unregisterMigration(version, callback);
			});
		},
		cb
	);
}


function getAvailableMigrations(vaultName, cb) {
	var path = configuration.getMigrationsPath(vaultName);

	fs.readdir(path, function (error, files) {
		if (error) {
			if (error.code === 'ENOENT') {
				logger.warning('No migration folder found for vault', vaultName, '(skipping).');
				return cb();
			}

			return cb(error);
		}

		var result = [];
		for (var i = 0; i < files.length; i++) {
			var file = files[i];

			if (extname(file) === '.js') {
				result.push(basename(file, '.js'));
			}
		}

		cb(null, result);
	});
}


function calculateMigration(target, available, applied) {
	available.sort(semver.compare);
	applied.sort(semver.compare);

	var current = applied.length ? applied[applied.length - 1] : 'v0.0.0';

	if (current === target) {
		logger.notice('Already at version:', target);
		return {
			direction: null,
			versions: []
		};
	}

	var direction = semver.gt(target, current) ? 'up' : 'down';
	var range;

	if (direction === 'up') {
		// we migrate up from 0.0.0 to the latest available (no newer than target)
		// it's possible

		range = '<=' + target;

		// only upgrade to versions that have never been applied

		available = available.filter(function (version) {
			return applied.indexOf(version) === -1;
		});
	} else {
		// we migrate down to the oldest available (but not target or older)
		// target is excluded because we don't migrate down further _from_ target

		range = '>' + target + ' <=' + current;

		// reverse the order in which migrations will be applied

		available.reverse();

		// only downgrade the versions that have actually been applied

		available = available.filter(function (version) {
			return applied.indexOf(version) !== -1;
		});
	}

	available = available.filter(function (version) {
		return semver.satisfies(version, range);
	});

	return {
		direction: direction,
		versions: available
	};
}


function migrateVaultToVersion(vault, targetVersion, cb) {
	if (typeof vault.getMigrations !== 'function') {
		logger.warning('Cannot migrate on vault', vault.name, '(skipping).');
		return cb();
	}

	// load applied versions

	vault.getMigrations(function (error, appliedVersions) {
		if (error) {
			return cb(error);
		}

		getAvailableMigrations(vault.name, function (error, available) {
			if (error) {
				return cb(error);
			}

			logger.debug('Available versions with migration paths:', available);

			var migration = calculateMigration(targetVersion, available, appliedVersions);

			logger.debug('Calculated migration path:', migration);

			if (migration.versions.length === 0) {
				logger.notice('No migrations to apply on vault', vault.name);
				return cb();
			}

			if (migration.direction === 'down') {
				migrateDown(vault, migration.versions, cb);
			} else {
				migrateUp(vault, migration.versions, cb);
			}
		});
	});
}


exports.migrateToVersion = function (targetVersion, cb) {
	// migrate to given version

	if (!targetVersion) {
		targetVersion = mage.rootPackage.version;
	}

	var vaults = configuration.getPersistentVaults();
	var vaultNames = Object.keys(vaults);

	async.eachSeries(
		vaultNames,
		function (vaultName, callback) {
			migrateVaultToVersion(vaults[vaultName], targetVersion, callback);
		},
		cb
	);
};
