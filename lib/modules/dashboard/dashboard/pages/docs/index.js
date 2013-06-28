var mage = require('mage');
var mageLoader = require('loader');

mageLoader.once('docs.display', function () {
	var forms = require('forms');
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
			// link to a website

			var win = window.open(href, '_blank');
			win.focus();
		} else {
			// link to another document

			var fullPath = pathJoin(current.relPath, href);
			var m = fullPath.match(/^(.+?)(\/[^\/]+?\.(md|mdown|markdown))?$/i);
			if (m) {
				var folder = m[1];
				var fileName = m[2] ? m[2].substr(1) : null; // substr in order to trim the leading slash

				try {
					history.push(current);

					setNode(folder, fileName);

					document.body.scrollIntoView(true);
				} catch (error) {
					console.error(error);
				}
			} else {
				console.error('Invalid file path:', fullPath);
			}
		}

		event.preventDefault();

		return false;
	}


	function renderDoc(relPath, fileName) {
		current.fileName = fileName;

		var fullPath = pathJoin(relPath, fileName);

		mage.dashboard.renderDoc(fullPath, function (error, rendered) {
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

		var node = currentTree;

		// go into the currentTree to find the subpath we're looking for

		var splitPath = relPath.split('/');

		for (var i = 0; i < splitPath.length; i++) {
			var chunk = splitPath[i];

			if (chunk !== '' && chunk !== '.') {
				node = node.folders[chunk];
			}
		}

		if (!node) {
			// path not found

			console.error('Path', relPath, 'not found.');
			return;
		}

		// start resetting the screen

		nav.textContent = 'Navigate: ';
		folderSelection.textContent = 'Folder: ';
		fileSelection.textContent = 'Document: ';
		content.innerHTML = '';
		path.textContent = 'Current folder: ' + relPath;

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

		radios = forms.radiobuttons('docs_nav', values, onchange);

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

		radios = forms.radiobuttons('folder', values, onchange);

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

		radios = forms.radiobuttons('doc', values, onchange);

		fileSelection.appendChild(radios.fragment);

		current = { relPath: relPath, fileName: activeFileName };

		if (activeFileName) {
			renderDoc(relPath, activeFileName);

			radios.inputs[stripFileName(activeFileName)].setAttribute('checked', 'checked');
		}
	}

	mage.dashboard.getDocTree(function (error, tree) {
		if (error) {
			return ui.notifications.send('Error while loading documentation');
		}

		currentTree = tree;

		// set the sidebar menu

		function nav(path) {
			if (current.fileName) {
				history.push(current);
			}

			setNode(path);
		}

		var items = [
			{ name: 'Start', cb: function () { nav('/'); } },
			{ name: 'MAGE', cb: function () { nav('/node_modules/mage'); } },
			{ name: 'Dependencies', cb: function () { nav('/node_modules'); } }
		];

		ui.sidebar.setPageMenu('docs', items);

		items[0].li.click();
	});
});
