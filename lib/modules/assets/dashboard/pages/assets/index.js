var mage = require('mage');
var mageLoader = require('loader');

var AssetPreviewer = require('AssetPreviewer');
var forms = require('forms');
var format = require('format');


var page = mageLoader.injectHtml('assets');
page.innerHTML = require('./page.html');


// cursor keys asset selection

var posHandler;
var ARROW_UP = 38;
var ARROW_DOWN = 40;

function keyHandler(evt) {
	// only accept key events from non-form elements, and only on the assets page

	if (!posHandler) {
		return;
	}

	if (evt.target && (evt.target.tagName === 'INPUT' || evt.target.tagName === 'TEXTAREA')) {
		return;
	}

	// go up or down in the list and prevent scrolling

	if (evt.which === ARROW_UP) {
		posHandler(-1);
		evt.preventDefault();
	} else if (evt.which === ARROW_DOWN) {
		posHandler(1);
		evt.preventDefault();
	}
}

mageLoader.on('assets.display', function () {
	document.addEventListener('keydown', keyHandler, true);
});

mageLoader.on('assets.close', function () {
	document.removeEventListener('keydown', keyHandler, true);
});


mageLoader.once('assets.display', function () {
	var cntApps = document.getElementById('cnt_assetmap_apps');
	var cntContexts = document.getElementById('cnt_assetmap_contexts');
	var btnNewAsset = document.getElementById('new_asset');
	var btnSearch = document.getElementById('assets_search');
	var cntAssetList = document.getElementById('cnt_asset_list');
	var cntAssetListStats = document.getElementById('cnt_asset_list_stats');
	var cntAssetPreview = document.getElementById('asset_preview_space');

	var notifications = mage.dashboard.ui.notifications;

	var previewer = new AssetPreviewer();
	cntAssetPreview.appendChild(previewer.elm);

	var currentState = {
		search: '',
		appName: null,
		assetMap: null,
		contextName: null
	};


	function describeClientConfig(clientConfig, compact) {
		var desc = [];

		if (clientConfig.language) {
			desc.push('language "' + clientConfig.language + '"');
		} else {
			if (!compact) {
				desc.push('any language');
			}
		}

		if (clientConfig.screen[0] <= 0 && clientConfig.screen[1] <= 0) {
			if (!compact) {
				desc.push('any resolution');
			}
		} else {
			if (compact) {
				desc.push('res >= ' + clientConfig.screen.join('x') + ' px');
			} else {
				desc.push('resolution >= ' + clientConfig.screen.join('x') + ' px');
			}
		}

		if (compact) {
			if (clientConfig.density > 1) {
				desc.push('density >= ' + clientConfig.density);
			}
		} else {
			desc.push('pixel density >= ' + clientConfig.density);
		}

		return desc;
	}


	function getVariantForClientConfig(clientConfig, localizedAssets) {
		var language = clientConfig.language ? ('' + clientConfig.language).toLowerCase() : null;
		var density = clientConfig.density || 1;
		var screen = clientConfig.screen || [0, 0];

		var localizedAsset = localizedAssets[language] || localizedAssets.default;

		if (!localizedAsset) {
			return;
		}

		var best = null;
		var bestScore = -1;

		for (var i = 0; i < localizedAsset.length; i++) {
			var variant = localizedAsset[i];
			var clientMatchIf = variant.clientMatchIf;

			// if our clientConfig is not compatible with this variant's requirements,
			// skip this variant

			if (density < clientMatchIf.density) {
				continue;
			}

			if (screen[0] < clientMatchIf.screen[0] || screen[1] < clientMatchIf.screen[1]) {
				continue;
			}

			// highest number of pixels on the screen wins

			var score = clientMatchIf.screen[0] * clientMatchIf.screen[1] *
				clientMatchIf.density * clientMatchIf.density;

			if (score > bestScore) {
				bestScore = score;
				best = variant;
			}
		}

		return best;
	}


	function renderAssetList() {
		var currentIdent = previewer.ident;
		var appName = currentState.appName;
		var contextInfo = currentState.assetMap.contexts[currentState.contextName];
		var assets = currentState.assetMap.assets[currentState.contextName] || {};
		var clientConfigs = currentState.assetMap.clientConfigs;

		posHandler = null;
		cntAssetList.innerHTML = '';
		previewer.clear();

		var checks = [], check;
		var i, len, j;

		for (j = 0; j < clientConfigs.length; j++) {
			checks.push({
				files: 0,
				size: 0,
				clientConfig: clientConfigs[j]
			});
		}

		// asset listing

		var identifiers = Object.keys(assets).sort();
		var filtered = [];

		// if a search string is given, match words

		var words = currentState.search ?
			currentState.search.trim().toLowerCase().split(/\s+/) :
			null;

		for (i = 0, len = identifiers.length; i < len; i++) {
			var ident = identifiers[i];
			var skip = false;

			if (words && words.length > 0) {
				var ciIdent = ident.toLowerCase();

				for (j = 0; j < words.length; j++) {
					if (ciIdent.indexOf(words[j]) === -1) {
						skip = true;
						break;
					}
				}
			}

			if (skip) {
				continue;
			}

			filtered.push(ident);

			var localizedAssets = assets[ident];

			for (j = 0; j < checks.length; j++) {
				check = checks[j];

				var variant = getVariantForClientConfig(check.clientConfig, localizedAssets);

				if (variant) {
					check.files += 1;
					check.size += variant.size;
				}
			}
		}

		// preview

		var pos;

		function onchange(ident) {
			previewer.setAsset(appName, contextInfo, ident, assets[ident]);

			pos = filtered.indexOf(ident);
		}

		var radios;

		function changeToPosition(newPos) {
			var input = radios.inputs[filtered[newPos]];
			var label = radios.labels[filtered[newPos]];

			if (input) {
				input.click();
			}

			if (label) {
				if (label.scrollIntoViewIfNeeded) {
					label.scrollIntoViewIfNeeded(false);
				} else {
					label.scrollIntoView(false);
				}
			}
		}

		if (filtered.length > 0) {
			radios = forms.radiobuttons('asset', filtered, onchange);

			cntAssetList.appendChild(radios.fragment);

			var index = currentIdent ? filtered.indexOf(currentIdent) : 0;

			if (index === -1) {
				// if the ident wasn't found, default to the first asset in the list
				index = 0;
			}

			changeToPosition(index);

			posHandler = function (delta) {
				changeToPosition(pos + delta);
			};
		} else {
			previewer.clear();
		}

		var stats = [];

		for (i = 0; i < checks.length; i++) {
			check = checks[i];

			stats.push('<b>' + describeClientConfig(check.clientConfig).join(', ') + '</b>');

			var size = format.fileSize(check.size, false);
			var kibiSize = format.fileSize(check.size, true);

			stats.push(check.files + ' files, ' + size + ' (' + kibiSize + ')');
			stats.push('');
		}

		cntAssetListStats.innerHTML = stats.join('<br>\n');

		// "new asset" button

		btnNewAsset.onclick = function () {
			// set previewer to empty asset

			var assetMap = currentState.assetMap;

			if (!assetMap) {
				return;
			}

			// ask for an ident

			var ident = window.prompt('Please enter an identifier for this asset');
			if (!ident) {
				return;
			}

			ident = ident.trim();
			if (!ident) {
				return;
			}

			// uncheck the active radio button

			if (radios) {
				radios.activeInput.checked = false;
			}

			// display an empty asset

			previewer.setAsset(appName, assetMap.contexts[currentState.contextName], ident, {});
		};
	}


	function renderFilters() {
		function rerender() {
			if (currentState.contextName) {
				renderAssetList();
			}
		}

		// generate context selection

		function contextchange(name) {
			currentState.contextName = name;
			rerender();
		}

		var names = Object.keys(currentState.assetMap.contexts).sort();

		var radios = forms.radiobuttons('context', names, contextchange);

		cntContexts.innerHTML = '';
		cntContexts.appendChild(radios.fragment);

		if (names[0]) {
			radios.inputs[names[0]].click();
		}

		// handle search input

		btnSearch.oninput = function () {
			currentState.search = this.value;

			rerender();
		};
	}


	function renderAppSelection(names) {
		// generate map selection

		function onchange(name) {
			mage.assets.getAssetMap(name, false, function (error, assetMap) {
				if (error) {
					return notifications.send('Error reading asset map', 'Asset map: ' + name);
				}

				currentState.appName = name;
				currentState.assetMap = assetMap;

				previewer.setup(assetMap.languages, Object.keys(assetMap.profiles));

				renderFilters();
			});
		}

		var radios = forms.radiobuttons('app', names, onchange);

		cntApps.innerHTML = '';
		cntApps.appendChild(radios.fragment);

		if (names[0]) {
			radios.inputs[names[0]].click();
		}
	}


	// previewer / mage.assets integration

	previewer.saveChanges = function (appName, contextName, ident, changes, cb) {
		mage.httpServer.transformEmbeddedUploads(changes);

		mage.assets.changeAsset(appName, contextName, ident, changes, function (error, newLocalizedAssets) {
			if (error) {
				return cb(error);
			}

			var assetMap = currentState.assetMap;

			if (!assetMap || assetMap.appName !== appName) {
				return cb(new Error('Changes saved, but unable to update preview.'));
			}

			if (!assetMap.assets[contextName]) {
				assetMap.assets[contextName] = {};
			}

			assetMap.assets[contextName][ident] = newLocalizedAssets;

			previewer.setAsset(appName, assetMap.contexts[contextName], ident, newLocalizedAssets);

			cb();
		});
	};


	previewer.rename = function (appName, contextName, oldIdent, newIdent, cb) {
		var assetMap = currentState.assetMap;

		if (!assetMap || assetMap.appName !== appName || !assetMap.assets[contextName]) {
			return cb(new Error('Context not found.'));
		}

		if (!assetMap.assets[contextName][oldIdent]) {
			// asset is a fresh new asset that is not yet in the asset map, so the server doesn't need updating

			previewer.setIdent(newIdent);

			return cb();
		}

		mage.assets.renameAsset(appName, contextName, oldIdent, newIdent, function (error, newLocalizedAssets) {
			if (error) {
				return cb(error);
			}

			delete assetMap.assets[contextName][oldIdent];

			assetMap.assets[contextName][newIdent] = newLocalizedAssets;

			previewer.setAsset(appName, assetMap.contexts[contextName], newIdent, newLocalizedAssets);

			renderAssetList();

			cb();
		});
	};


	previewer.delete = function (appName, contextName, ident, cb) {
		var assetMap = currentState.assetMap;

		if (!assetMap || assetMap.appName !== appName || !assetMap.assets[contextName]) {
			return cb(new Error('Context not found.'));
		}

		if (!assetMap.assets[contextName][ident]) {
			// asset is a fresh new asset that is not yet in the asset map, so the server doesn't need to delete anything

			previewer.clear();

			return cb();
		}

		mage.assets.deleteAsset(appName, contextName, ident, function (error) {
			if (error) {
				return cb(error);
			}

			delete assetMap.assets[contextName][ident];

			previewer.clear();

			renderAssetList();

			cb();
		});
	};


	mage.assets.listAssetMaps(function (error, appNames) {
		if (error) {
			return notifications.send('Error listing asset maps');
		}

		renderAppSelection(appNames);
	});
});
