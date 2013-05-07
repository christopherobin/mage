(function (window) {

	var mage = window.mage;

	mage.loader.renderPage('assets');

	mage.loader.once('assets.display', function () {

		var ui = mage.dashboard.ui;

		var cntApps = document.getElementById('cnt_assetmap_apps');
		var cntContexts = document.getElementById('cnt_assetmap_contexts');
		var btnSearch = document.getElementById('assets_search');
		var cntAssetList = document.getElementById('cnt_asset_list');
		var cntAssetPreview = document.getElementById('cnt_asset_preview');

		var notifications = mage.dashboard.ui.notifications;


		var renderers = {};

		renderers.unknown = function (version) {
			var div = document.createElement('div');
			div.textContent = 'Unknown file format: ' + version.format;
			return div;
		};

		renderers.image = function (version) {
			var bg = document.createElement('div');
			bg.className = 'checkered';

			var img = new Image();
			img.src = version.url;

			bg.appendChild(img);

			return bg;
		};

		renderers.audio = function (version) {
			var audio = document.createElement('audio');
			audio.src = version.url;
			audio.setAttribute('controls', 'controls');
			return audio;
		};


		var appended = {};
		var lastSampleText = 'The quick brown fox jumps over the lazy dog';

		renderers.font = function (version) {
			var fontName = 'sampleFont-' + version.ident;

			if (!appended[fontName]) {
				var style = document.createElement('style');
				var fontRule = "@font-face { font-family: '" + fontName + "'; src: url('" + version.url + "'); }";

				style.appendChild(document.createTextNode(fontRule));
				document.body.appendChild(style);

				appended[fontName] = true;
			}

			var div = document.createElement('div');
			div.style.textAlign = 'center';

			var form = document.createElement('form');
			form.onsubmit = function () {
				return false;
			};

			var textarea = document.createElement('textarea');
			textarea.onchange = function () {
				lastSampleText = this.value;
			};

			textarea.value = lastSampleText;
			textarea.style.display = 'block';
			textarea.style.width = '100%';
			textarea.style.height = '100px';
			textarea.style.fontFamily = fontName;

			form.appendChild(textarea);

			// TODO: add checkboxes for bold and italic

			// font size controls

			var dec = document.createElement('button');
			var inc = document.createElement('button');

			var fontSize;

			function setSize(size) {
				fontSize = size;
				textarea.style.fontSize = size + 'px';
				dec.textContent = (size - 1) + 'px';
				inc.textContent = (size + 1) + 'px';
			}

			setSize(30);

			dec.onclick = function () {
				if (fontSize > 2) {
					setSize(fontSize - 1);
				}
			};

			inc.onclick = function () {
				setSize(fontSize + 1);
			};

			div.appendChild(textarea);
			div.appendChild(dec);
			div.appendChild(inc);

			return div;
		};


		function formatToAssetType(format) {
			// turns a file extension into "audio", "video", "font", "image"

			var map = {
				audio: ['mp3', 'aac'],
				image: ['png', 'jpg', 'jpeg'],
				font: ['ttf', 'eot', 'woff']
			};

			for (var type in map) {
				if (map.hasOwnProperty(type) && map[type].indexOf(format) !== -1) {
					return type;
				}
			}
		}


		function previewAsset(versions) {
			cntAssetPreview.innerHTML = '';

			for (var i = 0; i < versions.length; i++) {
				var version = versions[i];
				var type = formatToAssetType(version.format);
				var renderer = type ? renderers[type] : null;

				if (!renderer) {
					renderer = renderers.unknown;
				}

				// make the preview figure

				var figure = document.createElement('figure');
				figure.style.textAlign = 'center';

				// asset type specific preview

				var preview = renderer(version);

				// caption

				var caption = document.createElement('figcaption');
				var title = [];

				if (version.language !== 'default') {
					title.push('language: ' + version.language);
				}

				title.push('format: ' + version.format);
				title.push('size: ' + version.size + ' bytes');

				caption.textContent = version.ident + ' [ ' + title.join(', ') + ' ]';

				// put them together

				figure.appendChild(caption);
				figure.appendChild(preview);

				cntAssetPreview.appendChild(figure);
			}
		}


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
				posHandler(-1); // up
				evt.preventDefault();
				break;
			case 40:
				posHandler(1); // down
				evt.preventDefault();
				break;
			}
		}, true);


		function renderAssets(assetMap, contextName, search) {
			var contextInfo = assetMap.contexts[contextName];
			var assets = assetMap.assets[contextName];

			posHandler = null;
			cntAssetList.innerHTML = '';
			cntAssetPreview.innerHTML = '';

			// asset listing

			var identifiers = Object.keys(assets).sort();

			// if a search string is given, match words

			var words = search ? search.trim().toLowerCase().split(/\s+/) : null;

			if (words && words.length > 0) {
				identifiers = identifiers.filter(function (ident) {
					ident = ident.toLowerCase();

					for (var i = 0; i < words.length; i++) {
						if (ident.indexOf(words[i]) === -1) {
							return false;
						}
					}

					return true;
				});
			}

			// preview

			var pos;

			function onchange(ident) {
				var assetInfo = assets[ident];
				var versions = [];

				for (var language in assetInfo) {
					var profiled = assetInfo[language];  // may be multiple for different profiles

					for (var i = 0; i < profiled.length; i++) {
						var asset = profiled[i];

						var version = {
							language: language,
							ident: ident,
							url: contextInfo.baseUrl + asset.path,
							profiles: asset.profiles,
							format: asset.format,
							cacheability: asset.cacheability,
							size: asset.size
						};

						versions.push(version);
					}
				}

				previewAsset(versions);
			}

			var radios;

			function changeToPosition(newPos) {
				var ident = identifiers[newPos];

				if (ident) {
					radios.inputs[identifiers[newPos]].click();
					pos = newPos;
				}
			}

			if (identifiers.length > 0) {
				radios = ui.forms.radiobuttons('asset', identifiers, onchange);

				cntAssetList.appendChild(radios.fragment);

				changeToPosition(0);

				posHandler = function (delta) {
					changeToPosition(pos + delta);
				};
			}
		}


		function renderFilters(assetMap) {
			var contextName;
			var searchString = '';

			function rerender() {
				if (contextName) {
					renderAssets(assetMap, contextName, searchString);
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


		function renderMapSelection(names) {
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


		mage.assets.listAssetMaps(function (error, names) {
			if (error) {
				return notifications.send('Error listing asset maps');
			}

			renderMapSelection(names);
		});
	});

}(window));
