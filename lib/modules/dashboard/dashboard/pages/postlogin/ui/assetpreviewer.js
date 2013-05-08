(function (window) {

	var mage = window.mage;

	var renderers = {};


	renderers.unknown = function (version) {
		var div = document.createElement('div');
		div.textContent = 'Unknown file format: ' + version.format;
		return div;
	};


	renderers.code = function (version) {
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

		xhr.open('GET', version.url, true);
		xhr.setRequestHeader('Cache-Control', 'no-cache');

		var m = version.url.match(/^[a-z]+:(\/\/)([^:]+:[^:]+)@/i);
		if (m) {
			xhr.setRequestHeader('Authorization', 'Basic ' + window.btoa(m[2]));
		}

		xhr.send(null);

		return code;
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
		audio.style.display = 'block';
		audio.style.width = '100%';
		return audio;
	};


	var appended = {};
	var lastSampleText = 'The quick brown fox jumps over the lazy dog. 漢字はこんな感じです。1234567890';

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
		textarea.style.height = '150px';
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

		var styles = mage.dashboard.ui.forms.checkboxes(['bold', 'italic'], function (name, checked) {
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


	function AssetPreviewer() {
	}


	AssetPreviewer.prototype.render = function (version) {
		var type = formatToAssetType(version.format);
		var renderer = type ? renderers[type] : null;

		if (!renderer) {
			renderer = renderers.unknown;
		}

		// make the preview figure

		var figure = document.createElement('figure');

		// asset type specific preview

		var preview = renderer(version);

		// caption

		var title = [];

		var fileSize = mage.dashboard.ui.format.fileSize;

		title.push('format: ' + version.format);
		title.push('size: ' + fileSize(version.size, false) + ' (' + fileSize(version.size, true) + ')');

		title = title.join(', ');

		// put them together

		figure.appendChild(preview);

		return {
			figure: figure,
			title: title
		};
	};


	mage.dashboard.ui.AssetPreviewer = AssetPreviewer;

}(window));
