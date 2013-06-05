$html5client('module.docs');

(function () {
	var mage = window.mage;

	mage.loader.once('docs.display', function () {
		var nav = document.getElementById('docs_nav');
		var folderSelection = document.getElementById('docs_folders');
		var fileSelection = document.getElementById('docs_files');
		var content = document.getElementById('docs_content');
		var path = document.getElementById('docs_path');

		var ui = mage.dashboard.ui;

		var current = { relPath: null, fileName: null };
		var currentTree;
		var history = [];
		var future = [];


		function pathJoin() {
			var result = [];
			var isAbsolute = false;

			for (var i = 0, len = arguments.length; i < len; i++) {
				var arg = arguments[i];

				while (arg[0] === '/') {
					isAbsolute = true;
					arg = arg.slice(1);
					result = [];
				}

				if (arg.length > 0) {
					result = result.concat(arg.split('/'));
				}
			}

			// remove relative "current path" periods and empty chunks (double slashes),

			for (i = 0; i < result.length; i++) {
				var chunk = result[i];

				if (chunk === '.' || chunk === '') {
					result.splice(i, 1);
					i -= 1;
				} else if (chunk === '..') {
					// backup one step

					if (i === 0 && isAbsolute) {
						//  we can't back up from "/", so we just ignore the ".."

						result.splice(i, 1);
						i -= 1;
					} else {
						var prev = result[i - 1];

						if (prev === '.') {
							// the case where we're at the top on a relative path: "."
							// make it a relative ".." instead

							result[i - 1] = '..';

							result.splice(i, 1);
							i -= 1;
						} else if (prev !== '..' && prev !== '') {
							// drop the previous entry, and our ".."

							result.splice(i - 1, 2);
							i -= 2;
						}
					}
				}
			}

			return (isAbsolute ? '/' : '') + result.join('/');
		}


		function followLink(event) {
			var href = this.getAttribute('href');
			if (href.match(/^https?:/)) {
				return true;
			}

			event.preventDefault();

			var fullPath = pathJoin(current.relPath, href).split('/');
			var fileName = fullPath.pop();
			fullPath = fullPath.join('/');

			setNode(fullPath, fileName);
			document.body.scrollIntoView(true);

			return false;
		}


		function renderDoc(relPath, fileName) {
			current.fileName = fileName;

			var fullPath = pathJoin(relPath, fileName);

			mage.docs.render(fullPath, function (error, rendered) {
				if (error) {
					content.textContent = error;
					return;
				}

				content.innerHTML = rendered;

				// make links work

				var aTags = content.getElementsByTagName('a');
				for (var i = 0, len = aTags.length; i < len; i++) {
					aTags[i].onclick = followLink;
				}
			});
		}


		function setNode(relPath, activeFileName) {
			relPath = relPath || '/';

			nav.textContent = 'Navigate: ';
			folderSelection.textContent = 'Folder: ';
			fileSelection.textContent = 'Document: ';
			content.innerHTML = '';
			path.textContent = 'Current folder: ' + relPath;

			var node = currentTree;
			var splitPath = relPath.split('/');

			for (var i = 0; i < splitPath.length; i++) {
				var chunk = splitPath[i];

				if (chunk !== '' && chunk !== '.') {
					node = node.folders[chunk];
				}
			}

			// preparation for radio buttons

			function onchange(value) {
				value.click();
			}

			var values, upPath, radios;

			// render back/forward navigation

			values = [];

			if (history.length > 0) {
				values.push({
					toString: function () { return 'back'; },
					click: function () {
						var entry = history.pop();
						if (!entry) {
							throw new Error('Cannot go further back');
						}

						future.push(current);

						setNode(entry.relPath, entry.fileName);
					}
				});
			}

			if (future.length > 0) {
				values.push({
					toString: function () { return 'forward'; },
					click: function () {
						var entry = future.pop();
						if (!entry) {
							throw new Error('Cannot go further back');
						}

						history.push(current);

						setNode(entry.relPath, entry.fileName);
					}
				});
			}

			radios = ui.forms.radiobuttons('docs_nav', values, onchange);

			nav.appendChild(radios.fragment);

			// render folders

			values = [];

			upPath = pathJoin(relPath, '..');

			if (upPath && upPath !== relPath) {
				values.push({
					toString: function () { return '..'; },
					click: function () {
						history.push(current);

						setNode(upPath);
					}
				});
			}

			Object.keys(node.folders).forEach(function (folderName) {
				values.push({
					toString: function () { return folderName; },
					click: function () {
						history.push(current);

						setNode(pathJoin(relPath, folderName));
					}
				});
			});

			radios = ui.forms.radiobuttons('folder', values, onchange);

			folderSelection.appendChild(radios.fragment);

			// render files

			function stripFileName(fileName) {
				var index = fileName.lastIndexOf('.');
				return (index === -1) ? fileName : fileName.substr(0, index);
			}

			values = [];

			node.files.forEach(function (fileName) {
				values.push({
					toString: function () { return stripFileName(fileName); },
					click: function () {
						history.push(current);

						setNode(relPath, fileName);
					}
				});

				if (!activeFileName && fileName.match(/README/i)) {
					activeFileName = fileName;
				}
			});

			radios = ui.forms.radiobuttons('doc', values, onchange);

			fileSelection.appendChild(radios.fragment);

			current = { relPath: relPath, fileName: activeFileName };

			if (activeFileName) {
				renderDoc(relPath, activeFileName);

				radios.inputs[stripFileName(activeFileName)].setAttribute('checked', 'checked');
			}
		}

		mage.docs.getDocTree(function (error, tree) {
			if (error) {
				return ui.notifications.send('Error while loading documentation');
			}

			currentTree = tree;
			setNode('/');
		});
	});

}());
