var mage = require('mage');
var EventEmitter = require('emitter');
var forms = require('forms');
var format = require('format');

var ui = mage.dashboard.ui;


function ext(fileName) {
	var periodIndex = fileName.lastIndexOf('.');
	if (periodIndex !== -1) {
		return fileName.substr(periodIndex + 1);
	}

	return '';
}

function getFileUrl(file, cb) {
	var URL = window.URL;

	if (URL && URL.createObjectURL) {
		return cb(null, URL.createObjectURL(file));
	}

	var reader = new FileReader();

	reader.onload = function (e) {
		// set url, format and fileSize

		cb(null, e.target.result);
	};

	reader.readAsDataURL(file);
}


function revokeFileUrl(url) {
	var URL = window.URL;

	if (URL && URL.revokeObjectURL) {
		URL.revokeObjectURL(url);
	}
}


var renderers = {};


renderers.unknown = function (url, format) {
	var div = document.createElement('div');
	div.textContent = 'Unknown file format: ' + format;
	return div;
};


renderers.code = function (url) {
	var code = document.createElement('code');
	code.style.overflowY = 'scroll';
	code.style.maxHeight = '400px';

	var xhr = new XMLHttpRequest();

	xhr.onreadystatechange = function () {
		if (xhr.readyState !== 4) {
			return;
		}

		code.textContent = xhr.responseText;
	};

	xhr.open('GET', url, true);
	xhr.setRequestHeader('Cache-Control', 'no-cache');

	var m = url.match(/^[a-z]+:(\/\/)([^:]+:[^:]+)@/i);
	if (m) {
		xhr.setRequestHeader('Authorization', 'Basic ' + window.btoa(m[2]));
	}

	xhr.send(null);

	return code;
};


renderers.image = function (url) {
	var bg = document.createElement('div');
	bg.className = 'checkered';

	var img = new Image();
	img.src = url;

	bg.appendChild(img);

	return bg;
};


renderers.audio = function (url) {
	var audio = document.createElement('audio');
	audio.src = url;
	audio.setAttribute('controls', 'controls');
	audio.style.display = 'block';
	audio.style.width = '100%';
	return audio;
};


var appended = {};
var lastSampleText = 'The quick brown fox jumps over the lazy dog. 漢字はこんな感じです。1234567890. Go ahead, type something!';
var nextFontId = 1;

renderers.font = function (url) {
	var fontName = 'sampleFont-' + nextFontId;

	nextFontId += 1;

	if (!appended[fontName]) {
		var style = document.createElement('style');
		var fontRule = '@font-face { font-family: \'' + fontName + '\'; src: url(\'' + url + '\'); }';

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
	textarea.style.height = '200px';
	textarea.style.fontFamily = fontName;

	form.appendChild(textarea);


	// font style display

	var fontStyle = {
		size: 30,
		bold: false,
		italic: false
	};

	var display = document.createElement('div');
	display.style.float = 'left';
	display.style.position = 'absolute';

	function updateFontStyle() {
		display.textContent = fontStyle.size + ' pixels';

		textarea.style.fontSize = fontStyle.size + 'px';
		textarea.style.fontWeight = fontStyle.bold ? 'bold' : 'normal';
		textarea.style.fontStyle = fontStyle.italic ? 'italic' : 'normal';
	}

	updateFontStyle();


	// font style controls

	var controls = document.createElement('div');

	var styles = forms.checkboxes(['bold', 'italic'], function (name, checked) {
		fontStyle[name] = checked;

		updateFontStyle();
	});

	controls.appendChild(styles.fragment);

	var dec = document.createElement('button');
	dec.textContent = '-1px';
	var inc = document.createElement('button');
	inc.textContent = '+1px';

	dec.onclick = function () {
		if (fontStyle.size > 2) {
			fontStyle.size -= 1;
			updateFontStyle();
		}
	};

	inc.onclick = function () {
		fontStyle.size += 1;
		updateFontStyle();
	};

	controls.appendChild(dec);
	controls.appendChild(inc);


	// put it all together

	div.appendChild(form);
	div.appendChild(display);
	div.appendChild(controls);

	return div;
};


function formatToAssetType(format) {
	// turns a file extension into "audio", "video", "font", "image"

	var map = {
		audio: ['mp3', 'aac'],
		image: ['png', 'jpg', 'jpeg'],
		font: ['ttf', 'eot', 'woff'],
		code: ['html']
	};

	for (var type in map) {
		if (map.hasOwnProperty(type) && map[type].indexOf(format) !== -1) {
			return type;
		}
	}
}


function VariantSlot(index, relPath, language, allProfiles, initialProfiles, initialVersion) {
	EventEmitter.call(this);

	this.index = index;
	this.relPath = relPath;
	this.language = language;
	this.allProfiles = allProfiles;
	this.initialProfiles = initialProfiles || [];
	this.initialVersion = initialVersion || undefined;
	this.currentVersion = initialVersion || undefined;
	this.elmContainer = document.createElement('section');

	this.elmCaption = document.createElement('h1');
	this.elmFigure = document.createElement('figure');
	this.formProfiles = document.createElement('form');
	this.profileCheckboxes = null;

	/**
	 * the operation that should be executed on save
	 *
	 * - null: do nothing
	 * - "delete": delete this variant
	 * - File object: replace this variant with the given file
	 */

	this.operation = null;

	this.build();

	if (this.currentVersion) {
		this.renderVariant();
	} else {
		this.renderAsCleared();
	}
}

VariantSlot.prototype = Object.create(EventEmitter.prototype);


VariantSlot.prototype.uncheckProfile = function (profile) {
	if (this.profileCheckboxes) {
		var input = this.profileCheckboxes.inputs[profile];

		if (input && input.checked) {
			input.click();
		}
	}
};


VariantSlot.prototype.build = function () {
	this.buildPreviewSpace();
	this.buildProfileSelection();
	this.buildEditControls();
};


VariantSlot.prototype.getChanges = function () {
	var profiles = this.profileCheckboxes ? this.profileCheckboxes.checked.slice() : [];
	var profilesUnchanged = (profiles.join(',') === this.initialProfiles.join(','));

	// if there are no changes, return nothing

	if (!this.operation && profilesUnchanged) {
		return;
	}

	return {
		relPath: this.relPath,
		operation: this.operation,
		language: this.language,
		profiles: profiles,
		file: this.currentVersion ? this.currentVersion.file : undefined,
		format: this.currentVersion ? this.currentVersion.format : undefined
	};
};


VariantSlot.prototype.unrender = function () {
	if (this.currentVersion && this.currentVersion.url) {
		revokeFileUrl(this.currentVersion.url);
	}

	this.elmContainer.style.borderColor = '';
};


VariantSlot.prototype.setMode = function (mode) {
	this.mode = mode;
	this.emit('modechange', mode);
};


VariantSlot.prototype.setOperation = function (operation) {
	this.operation = operation;

	this.emit('operationchange', operation);
};


VariantSlot.prototype.renderAsDeleted = function () {
	this.elmCaption.textContent = 'MARKED FOR DELETION';

	this.elmContainer.style.transition = '1s linear border';
	this.elmContainer.style.borderColor = '#f00';

	this.elmFigure.style.transition = '1s linear opacity';
	this.elmFigure.style.opacity = '0';

	var that = this;

	window.setTimeout(function () {
		// only if the mode is still "deleted" do we continue hiding elements

		if (that.mode === 'deleted') {
			that.elmFigure.innerHTML = '';
			that.formProfiles.style.display = 'none';
		}
	}, 1000);

	this.setMode('deleted');
};


VariantSlot.prototype.renderAsCleared = function () {
	this.elmCaption.textContent = 'New variant';
	this.elmFigure.innerHTML = '';
	this.formProfiles.style.display = 'none';

	this.setMode('cleared');
};


VariantSlot.prototype.renderVariant = function () {
	// uses format, fileSize and url to display the asset variant

	// caption

	var caption = 'format: ' + this.currentVersion.format + ', ' +
		'size: ' + format.fileSize(this.currentVersion.fileSize, false) +
		' (' + format.fileSize(this.currentVersion.fileSize, true) + ')';

	this.elmCaption.textContent = caption;

	// type specific preview logic

	var variantType = formatToAssetType(this.currentVersion.format);
	var renderer = variantType ? renderers[variantType] : null;

	if (!renderer) {
		renderer = renderers.unknown;
	}

	var elmPreview = renderer(this.currentVersion.url, this.currentVersion.format);

	this.elmFigure.innerHTML = '';
	this.elmFigure.appendChild(elmPreview);
	this.elmFigure.style.opacity = '1';

	this.formProfiles.style.display = '';

	this.setMode('rendered');
};


VariantSlot.prototype.buildPreviewSpace = function () {
	this.elmContainer.appendChild(this.elmCaption);
	this.elmContainer.appendChild(this.elmFigure);
};


VariantSlot.prototype.buildProfileSelection = function () {
	if (this.allProfiles.length === 0) {
		return;
	}

	var that = this;
	var i;

	// making a profileMap will force unique ID creation for the labels

	var profileMap = {};
	for (i = 0; i < this.allProfiles.length; i++) {
		profileMap[this.allProfiles[i]] = this.index;
	}

	function onclick(profile, checked) {
		// only if a profile got enabled, will we have a bunch of checks to do

		that.emit('profileschange', that.profileCheckboxes.checked);

		if (!checked) {
			return;
		}

		that.emit('profilechecked', profile);
	}

	this.profileCheckboxes = forms.checkboxes(profileMap, onclick);

	var elmProfiles = document.createElement('div');
	elmProfiles.style.margin = '10px 0';
	elmProfiles.textContent = 'Profiles (optional): ';

	elmProfiles.appendChild(this.profileCheckboxes.fragment);

	for (i = 0; i < this.initialProfiles.length; i++) {
		var profile = this.initialProfiles[i];
		var input = this.profileCheckboxes.inputs[profile];

		if (input && !input.checked) {
			input.click();
		}
	}

	this.formProfiles.onsubmit = function (e) {
		e.preventDefault();
		return false;
	};

	this.formProfiles.appendChild(elmProfiles);

	this.elmContainer.appendChild(this.formProfiles);
};


VariantSlot.prototype.buildEditControls = function () {
	var that = this;

	// file upload opportunity

	var elmUpload = document.createElement('input');
	elmUpload.type = 'file';

	elmUpload.onchange = function () {
		if (!this.files || !this.files.length) {
			return;
		}

		var file = this.files[0];
		this.value = '';

		getFileUrl(file, function (error, url) {
			if (error) {
				return;
			}

			// set url, format and fileSize

			var fileName = '' + file.name;
			var format = ext(fileName);

			that.unrender();

			that.currentVersion = {
				url: url,
				format: format,
				fileSize: file.size,
				file: file
			};

			that.setOperation('change');

			that.renderVariant();
		});
	};

	// reset to original version

	var elmReset = document.createElement('button');
	elmReset.className = 'small';
	elmReset.style.float = 'right';

	if (this.initialVersion) {
		elmReset.textContent = 'Back to original';
	} else {
		elmReset.textContent = 'Clear';
	}

	elmReset.onclick = function () {
		that.unrender();

		that.currentVersion = that.initialVersion;
		that.setOperation(null);

		if (that.currentVersion) {
			that.renderVariant();
		} else {
			that.renderAsCleared();
		}
	};

	this.on('modechange', function () {
		elmReset.style.display = (that.currentVersion === that.initialVersion) ? 'none' : '';
	});

	elmReset.style.display = (this.currentVersion === this.initialVersion) ? 'none' : '';

	// file delete opportunity

	var elmDelete;

	if (this.initialVersion) {
		elmDelete = document.createElement('button');
		elmDelete.textContent = 'Delete variant';
		elmDelete.className = 'small';
		elmDelete.style.float = 'right';

		elmDelete.onclick = function () {
			that.unrender();

			that.currentVersion = undefined;

			if (that.initialVersion) {
				that.setOperation('delete');
				that.renderAsDeleted();
			} else {
				that.setOperation(null);
				that.renderAsCleared();
			}
		};

		this.on('modechange', function (mode) {
			elmDelete.style.display = (mode === 'deleted') ? 'none' : '';
		});
	}


	// a form to capture manipulation

	var elmForm = document.createElement('form');

	elmForm.onsubmit = function (e) {
		e.preventDefault();
		return false;
	};

	elmForm.appendChild(elmUpload);
	elmForm.appendChild(elmReset);

	if (elmDelete) {
		elmForm.appendChild(elmDelete);
	}

	this.elmContainer.appendChild(elmForm);
};


function AssetPreviewer() {
	// create the core HTML

	this.elm = document.createElement('section');
	this.elm.className = 'dialog';

	this.elmTitleBar = document.createElement('h1');
	this.elmTitle = this.elmTitleBar.appendChild(document.createTextNode(''));

	this.elmControls = document.createElement('div');
	this.elmBody = document.createElement('div');

	this.elmSave = document.createElement('button');
	this.elmSave.textContent = 'Save changes';
	this.elmSave.setAttribute('disabled', 'disabled');

	this.elmHeaderButtons = document.createElement('div');
	this.elmHeaderButtons.style.position = 'absolute';
	this.elmHeaderButtons.style.top = '5px';
	this.elmHeaderButtons.style.right = '4px';

	this.elmRename = document.createElement('button');
	this.elmRename.className = 'small';
	this.elmRename.textContent = 'Rename';

	this.elmDelete = document.createElement('button');
	this.elmDelete.className = 'small';
	this.elmDelete.textContent = 'Delete';

	this.elmHeaderButtons.appendChild(this.elmRename);
	this.elmHeaderButtons.appendChild(this.elmDelete);

	this.elmLanguages = document.createElement('div');

	this.elmAddVariant = document.createElement('button');
	this.elmAddVariant.textContent = 'Add variant';

	this.elmControls.appendChild(this.elmLanguages);
	this.elmControls.appendChild(this.elmSave);
	this.elmControls.appendChild(this.elmAddVariant);

	this.elm.appendChild(this.elmHeaderButtons);
	this.elm.appendChild(this.elmTitleBar);
	this.elm.appendChild(this.elmControls);
	this.elm.appendChild(this.elmBody);

	// the variable part: languages and profiles

	this.languages = [];
	this.allProfiles = [];
	this.languageRadios = null;

	this.appName = null;
	this.contextInfo = null;
	this.ident = null;
	this.localizedAssets = null;

	this.nextVariantIndex = 1;
	this.variants = {};
	this.renderedLanguages = [];

	// hooks for integration

	this.saveChanges = null;
	this.rename = null;
}


AssetPreviewer.prototype.setup = function (languages, profiles) {
	// language selection

	// ensure languages start with "default"

	function injectItem(arr, item) {
		var index = arr.indexOf(item);

		if (index !== -1) {
			arr.splice(index, 1);
		}

		arr.unshift(item);
	}

	injectItem(languages, 'default');

	this.languages = languages;
	this.allProfiles = profiles;

	var that = this;
	var currentLanguage = null;

	function changeLanguage(language) {
		currentLanguage = language;
		that.displayVariants(language);
	}

	this.languageRadios = forms.radiobuttons('language', languages, changeLanguage);

	this.elmLanguages.textContent = 'Language: ';
	this.elmLanguages.appendChild(this.languageRadios.fragment);

	// add variant button

	this.elmAddVariant.onclick = function () {
		that.addEmptyVariant(currentLanguage);
	};

	this.elmSave.onclick = function () {
		that.triggerSaveChanges();
	};

	this.elmRename.onclick = function () {
		that.triggerRename();
	};

	this.elmDelete.onclick = function () {
		that.triggerDelete();
	};
};


AssetPreviewer.prototype.clear = function () {
	this.appName = null;
	this.contextInfo = null;
	this.ident = null;
	this.localizedAssets = null;

	this.nextVariantIndex = 1;
	this.variants = {};
	this.renderedLanguages = [];

	this.elmHeaderButtons.style.display = 'none';
	this.elmControls.style.display = 'none';
	this.elmTitle.nodeValue = 'No asset selected';
	this.elmBody.innerHTML = '';
};


AssetPreviewer.prototype.setIdent = function (ident) {
	// for simple renames without touching content

	this.ident = ident;
	this.elmTitle.nodeValue = ident;
};


AssetPreviewer.prototype.setAsset = function (appName, contextInfo, ident, localizedAssets) {
	// reset

	this.clear();

	// set the current asset data

	this.appName = appName;
	this.contextInfo = contextInfo;
	this.localizedAssets = localizedAssets;
	this.setIdent(ident);

	// get the first language that is available in localizedAssets
	// we can skip index 0, since that is "default"

	var language = 'default';

	for (var i = 1; i < this.languages.length; i++) {
		if (localizedAssets.hasOwnProperty(this.languages[i])) {
			language = this.languages[i];
			break;
		}
	}

	// click on the right language
	// this will trigger displayVariants to be called

	this.languageRadios.inputs[language].click();
};


AssetPreviewer.prototype.displayVariants = function (language) {
	this.renderVariants(language);

	for (var index in this.variants) {
		var variant = this.variants[index];

		variant.elmContainer.style.display = (variant.language === language) ? '' : 'none';
	}
};


AssetPreviewer.prototype.renderVariants = function (language) {
	if (this.renderedLanguages.indexOf(language) !== -1) {
		return;
	}

	this.renderedLanguages.push(language);

	this.elmHeaderButtons.style.display = '';
	this.elmControls.style.display = '';

	var variants = this.localizedAssets[language];

	if (variants) {
		for (var i = 0; i < variants.length; i++) {
			this.addVariant(language, variants[i]);
		}
	}
};


AssetPreviewer.prototype.addVariant = function (language, variant) {
	var url = this.contextInfo.baseUrl + variant.path + '?' + variant.digest;

	var initialVersion = {
		url: url,
		format: variant.format,
		fileSize: variant.size
	};

	this.createVariantSlot(language, variant.relPath, variant.profiles, initialVersion);
};


AssetPreviewer.prototype.addEmptyVariant = function (language) {
	this.createVariantSlot(language);
};


AssetPreviewer.prototype.createVariantSlot = function (language, relPath, initialProfiles, initialVersion) {
	var elmSave = this.elmSave;
	var variants = this.variants;
	var variantIndex = '' + this.nextVariantIndex;

	this.nextVariantIndex += 1;

	var entry = new VariantSlot(variantIndex, relPath, language, this.allProfiles, initialProfiles, initialVersion);

	entry.on('profilechecked', function (profile) {
		// check all other variants within this language and disable this profile there

		for (var index in variants) {
			if (variants.hasOwnProperty(index)) {
				var variant = variants[index];

				if (index !== variantIndex && variant.language === language) {
					variant.uncheckProfile(profile);
				}
			}
		}
	});

	function checkSaveButton() {
		var hasChanges = Object.keys(variants || {}).some(function (index) {
			return variants[index].getChanges();
		});

		if (hasChanges) {
			elmSave.removeAttribute('disabled');
		} else {
			elmSave.setAttribute('disabled', 'disabled');
		}
	}

	entry.on('operationchange', checkSaveButton);
	entry.on('profileschange', checkSaveButton);

	this.elmBody.insertBefore(entry.elmContainer, this.elmBody.firstChild);

	variants[variantIndex] = entry;

	return entry;
};


AssetPreviewer.prototype.triggerSaveChanges = function () {
	if (!this.saveChanges) {
		return ui.notifications.send('This preview is read only');
	}

	var changes = [];

	for (var index in this.variants) {
		if (this.variants.hasOwnProperty(index)) {
			var change = this.variants[index].getChanges();

			if (change) {
				changes.push(change);
			}
		}
	}

	var ident = this.ident;

	this.saveChanges(this.appName, this.contextInfo.name, ident, changes, function (error) {
		if (error) {
			return ui.notifications.send('Error while saving changes');
		}

		ui.notifications.send('Saved changes to ' + ident);
	});
};


AssetPreviewer.prototype.triggerRename = function () {
	if (!this.rename) {
		return ui.notifications.send('This preview is read only');
	}

	var newIdent = window.prompt('Rename the identifier for this asset:', this.ident);
	if (!newIdent) {
		return;
	}

	newIdent = newIdent.trim();
	if (!newIdent || newIdent === this.ident) {
		return;
	}

	this.rename(this.appName, this.contextInfo.name, this.ident, newIdent, function (error) {
		if (error) {
			return ui.notifications.send('Error while renaming. There may already be an asset by that name.');
		}

		ui.notifications.send('Asset renamed to ' + newIdent);
	});
};


AssetPreviewer.prototype.triggerDelete = function () {
	if (!this.delete) {
		return ui.notifications.send('This preview is read only');
	}

	var confirmation = window.prompt('Type DELETE if you really want to remove this entire asset.');
	if (confirmation !== 'DELETE') {
		return;
	}

	this.delete(this.appName, this.contextInfo.name, this.ident, function (error) {
		if (error) {
			return ui.notifications.send('Error while deleting.');
		}

		ui.notifications.send('Asset deleted.');
	});
};


module.exports = AssetPreviewer;