#!/usr/bin/env node


var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');


childProcess.exec('node . show-config "apps"', function (error, stdout) {
	if (error) {
		console.error(error);
		process.exit(1);
	}

	//
	var appConfigs = JSON.parse(stdout);

	//
	var componentPaths = [];
	for (var app in appConfigs) {
		var componentPath = path.join('www', app);
		if (!fs.existsSync(path.join(componentPath, 'component.json'))) {
			continue;
		}

		componentPaths.push(path.join('www', app));
	}

	//
	console.log(componentPaths.join(' '));
});