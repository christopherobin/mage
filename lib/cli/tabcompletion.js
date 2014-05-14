var tab = require('tabalot');


//Every tabalot call needs to end with a function that console logs the options
var tabScriptSuffix = function (opts) {
	console.log(opts);
};

//Takes a commander command and run tabalot functions on it to make it "tab completable"
function tabalotScriptFromCommanderArg(command) {
	if (command.options) {
		var options = command.options.map(function (option) {
			return option.long;
		});
		return tab(command._name)(options)(tabScriptSuffix);
	}
	tab(command._name)(tabScriptSuffix);
}

//Runs through each option and command of a commander program 
// and then run the necessary methods to make those "tab completable"
function tabifyCommands(program) {
	program.options.forEach(function (option) {
		tab(option.long);
	});
	program.commands.forEach(tabalotScriptFromCommanderArg);
	tab.parse();
}

exports.tabifyCommands = tabifyCommands;
