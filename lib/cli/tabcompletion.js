var tab = require('tabalot');

/* Utility functions */
function isInCompletion() {
	return process.argv.some(function (arg) {
		return arg === "completion";
	});
}

function isGettingCompletionScript() {
	var hasTwoDashes = process.argv.some(function (arg) {
		return arg === "--";
	});

	return isInCompletion() && !hasTwoDashes;
}

function isSavingCompletionScript() {
	var isSaving = process.argv.some(function (arg) {
		return arg === "--save";
	});
	return isSaving && isGettingCompletionScript();
}

function stripWeirdCharacters(text) {
	return text.replace(/([^a-z0-9]+)/gi, '_');
}


//Every tabalot call needs to end with a function that console logs the options
var tabScriptSuffix = function (opts) {
	console.log(opts);
	process.exit(0);
};

//Takes a commander command and run tabalot functions on it to make it "tab completable"
function tabalotScriptFromCommand(command) {
	if (command.options) {
		var options = command.options.map(function (option) {
			return option.long;
		});
		return tab(command._name)(options)(tabScriptSuffix);
	}
	tab(command._name)(tabScriptSuffix);
}

/* 
 * Processing on arguments/commands provided to the CLI
 *	Logic being the following:
 *		- If the user is trying to generate the bash completion script,
 *			instead of passing the bin and the filename to the CLI, we get it through mage.
 */
function addCompletionCommands(main, rootPath, filename, argv) {
	if (isGettingCompletionScript()) {
		if (!main) {
			console.error('Tab completion cannot be installed in your project. Reason: "main" is undefined in package.json');
		}
		else {
			argv.push('--bin', main);
			argv.push('--completion', 'node ' + rootPath + '');
		}
	}

	if (isSavingCompletionScript()) {
		var file = filename || main;
		argv.push('--filename', stripWeirdCharacters(file));
	}
	return argv;
}

/*
 * Runs through each option and command of a commander program
 *	and then run the necessary methods to make those "tab completable"
 */
function tabifyCommands(program, argv) {
	program.options.forEach(function (option) {
		tab(option.long)(tabScriptSuffix);
	});
	program.commands.forEach(tabalotScriptFromCommand);
	tab.parse(argv.slice(2));
}



exports.tabifyCommands = tabifyCommands;
exports.isInCompletion = isInCompletion;
exports.addCompletionCommands = addCompletionCommands;
