(function (window) {

	var mage = window.mage;

	mage.loader.renderPage('assets');

	mage.loader.once('assets.display', function () {

		var ui = mage.dashboard.ui;

		var cntApps = document.getElementById('cnt_assetmap_apps');
		var cntContexts = document.getElementById('cnt_assetmap_contexts');
		var btnSearch = document.getElementById('assets_search');
		var cntAssetList = document.getElementById('cnt_asset_list');
		var cntAssetListStats = document.getElementById('cnt_asset_list_stats');
		var cntAssetPreview = document.getElementById('cnt_asset_preview');
		var assetPreviewTitle = document.getElementById('asset_preview_title');

		var notifications = mage.dashboard.ui.notifications;


		var posHandler;
		var allowPosHandler = true;

		mage.loader.on('assets.close', function () {
			allowPosHandler = false;
		});

		mage.loader.on('assets.display', function () {
			allowPosHandler = true;
		});

		document.addEventListener('keydown', function (evt) {
			// only accept key events from non-form elements, and only on the assets page

			if (!posHandler || !allowPosHandler) {
				return;
			}

			if (evt.target && evt.target.tagName === 'INPUT' || evt.target.tagName === 'TEXTAREA') {
				return;
			}

			switch (evt.which) {
			case 38:
				posHandler(-1); // arrow up
				evt.preventDefault();
				break;
			case 40:
				posHandler(1);  // arrow down
				evt.preventDefault();
				break;
			}
		}, true);


		function describeClientConfig(clientConfig) {
			var desc = ['Lang: ' + (clientConfig.language || 'none')];

			if (clientConfig.screen[0] <= 1 && clientConfig.screen[1] <= 1) {
				desc.push('Resolution: any');
			} else {
				desc.push('Resolution: ' + clientConfig.screen.join('x') + ' px');
			}

			desc.push('Pixel density: x' + clientConfig.density);

			return desc;
		}


		function clearPreview() {
			cntAssetPreview.innerHTML = '';
			assetPreviewTitle.textContent = 'No asset selected';
		}


		function previewAsset(contextInfo, assetInfo) {
			var previewer = new ui.AssetPreviewer();

			cntAssetPreview.innerHTML = '';

			for (var language in assetInfo) {
				var profiled = assetInfo[language];  // may be multiple for different profiles

				for (var i = 0; i < profiled.length; i++) {
					var asset = profiled[i];

					var version = {
						url: contextInfo.baseUrl + asset.path,
						format: asset.format,
						language: language,
						size: asset.size
					};

					var rendered = previewer.render(version);

					assetPreviewTitle.textContent = rendered.title;

					cntAssetPreview.appendChild(rendered.figure);
				}
			}
		}


		function getVariantForClientConfig(clientConfig, assetInfo) {
			var language = clientConfig.language ? ('' + clientConfig.language).toLowerCase() : null;
			var density = clientConfig.density || 1;
			var screen = clientConfig.screen || [1, 1];

			var localizedAsset = assetInfo[language] || assetInfo.default;

			if (!localizedAsset) {
				return;
			}

			var best = null;
			var bestScore = -1;

			for (var i = 0; i < localizedAsset.length; i++) {
				var variant = localizedAsset[i];
				var clientMatchIf = variant.clientMatchIf;

				// if our clientConfig is not compatible with this variant's requirements, skip this variant

				if (density < clientMatchIf.density || screen[0] < clientMatchIf.screen[0] || screen[1] < clientMatchIf.screen[1]) {
					continue;
				}

				// highest number of pixels on the screen wins

				var score = clientMatchIf.screen[0] * clientMatchIf.screen[1] * clientMatchIf.density * clientMatchIf.density;

				if (score > bestScore) {
					bestScore = score;
					best = variant;
				}
			}

			return best;
		}


		function renderAssetList(assetMap, contextName, search) {
			var contextInfo = assetMap.contexts[contextName];
			var assets = assetMap.assets[contextName];
			var clientConfigs = assetMap.clientConfigs;

			posHandler = null;
			cntAssetList.innerHTML = '';
			cntAssetPreview.innerHTML = '';

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

			var words = search ? search.trim().toLowerCase().split(/\s+/) : null;

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

				var assetInfo = assets[ident];

				for (j = 0; j < checks.length; j++) {
					check = checks[j];

					var variant = getVariantForClientConfig(check.clientConfig, assetInfo);

					if (variant) {
						check.files += 1;
						check.size += variant.size;
					}
				}
			}

			// preview

			var pos;

			function onchange(ident) {
				previewAsset(contextInfo, assets[ident]);
			}

			var radios;

			function changeToPosition(newPos) {
				var ident = filtered[newPos];

				if (ident) {
					radios.inputs[filtered[newPos]].click();
					pos = newPos;
				}
			}

			if (filtered.length > 0) {
				radios = ui.forms.radiobuttons('asset', filtered, onchange);

				cntAssetList.appendChild(radios.fragment);

				changeToPosition(0);

				posHandler = function (delta) {
					changeToPosition(pos + delta);
				};
			} else {
				clearPreview();
			}

			var stats = [];

			for (i = 0; i < checks.length; i++) {
				check = checks[i];

				stats.push('<b>' + describeClientConfig(check.clientConfig).join(', ') + '</b>');
				stats.push(check.files + ' files');
				stats.push(ui.format.fileSize(check.size, false) + ' (' + ui.format.fileSize(check.size, true) + ')');
			}

			cntAssetListStats.innerHTML = stats.join('<br>\n');
		}


		function renderFilters(assetMap) {
			var contextName;
			var searchString = '';

			function rerender() {
				if (contextName) {
					renderAssetList(assetMap, contextName, searchString);
				}
			}

			// generate context selection

			function contextchange(name) {
				contextName = name;
				rerender();
			}

			var names = Object.keys(assetMap.contexts);

			var radios = ui.forms.radiobuttons('context', names, contextchange);

			cntContexts.innerHTML = '';
			cntContexts.appendChild(radios.fragment);

			if (names[0]) {
				radios.inputs[names[0]].click();
			}

			// handle search input

			btnSearch.onkeyup = function () {
				var search = this.value;

				if (search === searchString) {
					return;
				}

				searchString = search;

				rerender();
			};
		}


		function renderAppSelection(names) {
			// generate map selection

			function onchange(name) {
				mage.assets.getAssetMap(name, function (error, assetMap) {
					if (error) {
						return notifications.send('Error reading asset map', 'Asset map: ' + name);
					}

					renderFilters(assetMap);
				});
			}

			var radios = ui.forms.radiobuttons('app', names, onchange);

			cntApps.innerHTML = '';
			cntApps.appendChild(radios.fragment);

			if (names[0]) {
				radios.inputs[names[0]].click();
			}
		}


		mage.assets.listAssetMaps(function (error, appNames) {
			if (error) {
				return notifications.send('Error listing asset maps');
			}

			renderAppSelection(appNames);
		});
	});

}(window));
