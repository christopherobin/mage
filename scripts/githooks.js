#!/usr/bin/env node

var exec = require('child_process').exec;
var fs = require('fs');
var readline = require('readline');

// global variables

var gitTop;
var hooksPath;

// functions

function makePreCommit(inp) {
	inp = inp || 'lint-staged test';

	console.log('Make command that will be run on commit: ' + inp);
	console.log('Creating pre-commit script...');

	var preCommitPath = hooksPath + '/pre-commit';

	var buffer;

	buffer = '#!/bin/sh\n' +
		'make -C "' + gitTop + '" ' + inp + '\n';
	fs.writeFileSync(preCommitPath, buffer);

	var mode = 775;
	console.log('Setting ' + preCommitPath + ' to be executable (' + mode + ')');
	fs.chmodSync(preCommitPath, parseInt(mode, 8));
}

function createGitHooks() {

	var gitPath = gitTop + '/.git';

	console.log('Making sure ' + gitPath + ' exists...');

	if (!fs.existsSync(gitPath)) {
		console.log('Error: directory ' + gitPath + ' not found.');
		process.exit(1);
	}

	console.log(gitPath + ' found.');

	// ensure .git/hooks exists, if not create it
	hooksPath = gitPath + '/hooks';

	if (!fs.existsSync(hooksPath)) {
		console.log('Directory ' + hooksPath + ' not found, creating...');
		fs.mkdirSync(hooksPath);
	}

	var rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	rl.question('Make command to run before commit (default: lint-staged test): ', function (answer) {
		makePreCommit(answer);
		rl.close();
	});
}

// script

console.log('Detecting git repository root...');
exec('git rev-parse --show-toplevel', function (error, stdout, stderr) {
	if (error) {
		process.stderr.write(stderr);
		console.log('Error: failed to detect git repository root (is this a repository?)');
		process.exit(1);
	} else {
		gitTop = stdout.replace(/\n$/, ''); // remove end newline
		createGitHooks();
	}
});

