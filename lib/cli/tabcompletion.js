var tab = require('tabalot');


//Why a function? It might eventually be modified using arguments, so using a function will require less refactoring.
function getTabScriptSuffix() {
	return function (opts) {
		console.log(opts);
	};
}


function tabalotScriptFromCommanderArg(argument) {
	if (argument.options) {
		var options = argument.options.map(function (option) {
			return option.long;
		});
		return tab(argument._name)(options)(getTabScriptSuffix());
	}
	return tab(argument._name)(getTabScriptSuffix());
}

function tabalotScriptFromCommander(com) {
	com.options.forEach(function (option) {
		return tab(option.long);
	});
	com.commands.forEach(tabalotScriptFromCommanderArg);
}

function tabifyCommands(program) {
	tabalotScriptFromCommander(program);
	tab.parse();
}

exports.tabifyCommands = tabifyCommands;
