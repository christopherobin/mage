var tab = require('tabalot');


//Why a function? It might eventually be modified using arguments, so using a function will require less refactoring.
function getTabScriptSuffix() {
	//Every tabalot call needs to end with a function that console logs the options
	return function (opts) {
		console.log(opts);
	};
}

//Takes a commander command and run tabalot functions on it to make it "tab completable"
function tabalotScriptFromCommanderArg(argument) {
	if (argument.options) {
		var options = argument.options.map(function (option) {
			return option.long;
		});
		return tab(argument._name)(options)(getTabScriptSuffix());
	}
	tab(argument._name)(getTabScriptSuffix());
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
