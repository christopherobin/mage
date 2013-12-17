var mage = require('mage');
var mageLoader = require('loader');

var forms = require('forms');

var identConfig;

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
	var cntEngines = document.getElementById('cnt_ident_engines');
	var cntMain = document.getElementById('cnt_ident');

	function displayEngines() {
		var engineConfigs = identConfig && identConfig.engines;

		if (!engineConfigs) {
			return;
		}

		// the engine list
		var engineNames = Object.keys(engineConfigs);

		var engineChoice = {};
		for (var i = 0; i < engineNames.length; i++) {
			var engineName = engineNames[i];
			engineChoice[engineName] = engineName + ' (' + engineConfigs[engineName].type + ')';
		}

		var radios = forms.radiobuttons('engine', engineChoice, function (engineName) {
			// clear the main display
			cntMain.innerHTML = '';

			// get the engine config
			var cfg = engineConfigs[engineName];

			if (!cfg) {
				return;
			}

			// then retrieve the main module for it
			var engine = getEngine(cfg.type);

			// maybe there is no dashboard module for it?
			if (!engine) {
				cntMain.innerHTML = '<p>The ' + cfg.type + ' engine does not provide a management dashboard.</p>';
				return;
			}

			engine.display(cntMain, engineName, cfg);
		});

		cntEngines.innerHTML = '';
		cntEngines.appendChild(radios.fragment);

		if (engineNames[0]) {
			radios.inputs[engineNames[0]].click();
		}
	}

	mage.ident.getConfig(function (error, config) {
		if (error) {
			return;
		}

		// store a copy for when we click on stuff
		identConfig = config;

		// then display it
		displayEngines();
	});
});