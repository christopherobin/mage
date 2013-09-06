#!/usr/bin/env node

var exec = require("child_process").exec;
var fs = require("fs");
var readline = require("readline");

// global variables

var gittop;
var gitpath;
var hookspath;

// functions

function makePreCommit(inp) {
	if (inp === "") {
		inp = "lint-staged test";
	}

	console.log("Make command that will be run on commit: " + inp);
	console.log("Creating pre-commit script...");

	var precommitpath = hookspath + "/pre-commit";

	var buffer;

	buffer = "#!/bin/sh\n";
	fs.writeFileSync(precommitpath, buffer);

	buffer = "make -C \"" + gittop + "\" " + inp + "\n";
	fs.appendFileSync(precommitpath, buffer);

	console.log("Setting " + precommitpath + " to be executable (775)");
	fs.chmodSync(precommitpath, 0775);
}

function setupGITHooks()
{
	// ensure .git/hooks exists, if not create it
	hookspath = gitpath + "/hooks";

	if (!fs.existsSync(hookspath)) {
		console.log("Directory " + hookspath + " not found, creating...");
		fs.mkdirSync(hookspath);
	}

	var rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	rl.question("Make command to run before commit (default: lint-staged test): ", function (answer) {
		makePreCommit(answer);
		rl.close();
	});
}

function getGITPath(error, stdout, stderr) {
	if (error !== null) {
		process.stderr.write(stderr);
		console.log("Error: failed to detect git repository root (is this a repository?)");
		process.exit(1);
	}

	gittop = stdout.replace(/\n$/, ""); // remove end newline
	gitpath = gittop + "/.git";

	console.log("Making sure " + gitpath + " exists...");

	if (!fs.existsSync(gitpath)) {
		console.log("Error: directory " + gitpath + " not found.");
		process.exit(1);
	}

	console.log(gitpath + " found.");

	setupGITHooks();
}

// script

console.log("Detecting git repository root...");
exec("git rev-parse --show-toplevel", getGITPath);

