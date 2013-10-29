var mage = require('mage');
var mageLoader = require('loader');

var forms = require('forms');

var identConfig;
var apps = [];

// here we store the requires for each engine
var engines = {};

function getEngine(engine) {
	if (!engines[engine]) {
		var engineModule;

		try {
			engineModule = require('ident-' + engine);
		} catch (e) {
			return false;
		}

		engines[engine] = engineModule;
	}

	return engines[engine];
}

mageLoader.once('ident.display', function () {

	var cntApps = document.getElementById('cnt_ident_apps');
	var cntEngines = document.getElementById('cnt_ident_engines');
	var cntMain = document.getElementById('cnt_ident');

	function displayEngines(appName) {
		if (!appName || !identConfig[appName]) {
			return;
		}

		// the engine list
		var engineNames = Object.keys(identConfig[appName]);

		var engines = {};
		for (var i = 0; i < engineNames.length; i++) {
			var engineName = engineNames[i];
			engines[engineName] = engineName + ' (' + identConfig[appName][engineName].type + ')';
		}

		var radios = forms.radiobuttons('engine', engines, function (engineName) {
			// clear the main display
			cntMain.innerHTML = '';

			if (!identConfig[appName] || !identConfig[appName][engineName]) {
				return;
			}

			// get the engine config
			var cfg = identConfig[appName][engineName];

			// then retrieve the main module for it
			var engine = getEngine(cfg.type);

			// maybe there is no dashboard module for it?
			if (!engine) {
				return;
			}


			engine.display(cntMain, appName, engineName, cfg);
		});

		cntEngines.innerHTML = '';
		cntEngines.appendChild(radios.fragment);

		if (engineNames[0]) {
			radios.inputs[engineNames[0]].click();
		}
	}

	function displayApps() {
		var radios = forms.radiobuttons('app', apps, function (appName) {
			displayEngines(appName);
		});

		cntApps.innerHTML = '';
		cntApps.appendChild(radios.fragment);

		if (apps[0]) {
			radios.inputs[apps[0]].click();
		}
	}

	mage.ident.getConfig(function (err, config) {
		// that should not happen on the dashboard!
		if (err) {
			return;
		}

		// store a copy for when we click on stuff
		identConfig = config;

		// build a list of apps
		apps = Object.keys(identConfig);

		// then display it
		displayApps();
	});
});