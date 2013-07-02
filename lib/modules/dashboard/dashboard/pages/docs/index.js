// Tell jshint that we don't mind late definitions, since we have a circular reference between
// setNode and other functions.

/* jshint latedef: false */

var mage = require('mage');

var folderSelection = document.getElementById('docs_folders');
var fileSelection = document.getElementById('docs_files');
var content = document.getElementById('docs_content');
var path = document.getElementById('docs_path');

var ui = mage.dashboard.ui;

var current = {
	relPath: null,
	fileName: null
};

var currentTree;


function pathJoin() {
	var result = [];
	var isAbsolute = false;

	for (var i = 0, len = arguments.length; i < len; i++) {
		var arg = arguments[i];

		if (typeof arg === 'string') {
			while (arg[0] === '/') {
				isAbsolute = true;
				arg = arg.slice(1);
				result = [];
			}

			if (arg.length > 0) {
				result = result.concat(arg.split('/'));
			}
		}
	}

	// remove relative "current path" periods and empty chunks (double slashes),

	for (i = 0; i < result.length; i++) {
		var chunk = result[i];

		if (chunk === '.' || chunk === '') {
			result.splice(i, 1);
			i -= 1;
			continue;
		}

		if (chunk !== '..') {
			// nothing to do
			continue;
		}

		// chunk is "..", so backup one step

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

	return (isAbsolute ? '/' : '') + result.join('/');
}


function renderFullPath(fullPath) {
	var m = fullPath.match(/^(.*?)([^\/]+?\.(md|mdown|markdown))?$/i);
	if (!m) {
		return console.error('Invalid file path:', fullPath);
	}

	var folder = m[1];
	var fileName = m[2];

	try {
		setNode(folder, fileName);

		document.body.scrollIntoView(true);
	} catch (error) {
		console.error(error);
	}
}


function followLink(event) {
	var href = this.getAttribute('href');

	if (href.match(/^https?:/)) {
		// link to a website

		window.open(href, '_blank').focus();
	} else {
		// link to another document

		renderFullPath(pathJoin(current.relPath, href));
	}

	event.preventDefault();

	return false;
}


function renderDoc(relPath, fileName) {
	current.fileName = fileName;

	var fullPath = pathJoin(relPath, fileName);

	mage.dashboard.renderDoc(fullPath, function (error, rendered) {
		if (error) {
			return ui.notifications.send('Error rendering documentation');
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

	var fullPath = pathJoin(relPath, activeFileName);

	ui.router.set('docs' + fullPath);

	// start resetting the screen

	folderSelection.textContent = 'Folder: ';
	fileSelection.textContent = 'Document: ';
	content.innerHTML = '';
	path.textContent = 'Current folder: ' + relPath;

	// preparation for radio buttons

	function onchange(value) {
		value.click();
	}

	var values, upPath, radios;

	// render folders

	values = [];

	upPath = pathJoin(relPath, '..');

	if (upPath && upPath !== relPath) {
		values.push({
			toString: function () { return '..'; },
			click: function () {
				setNode(upPath);
			}
		});
	}

	Object.keys(node.folders).forEach(function (folderName) {
		values.push({
			toString: function () { return folderName; },
			click: function () {
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
				setNode(relPath, fileName);
			}
		});

		if (!activeFileName && fileName.match(/README/i)) {
			activeFileName = fileName;
		}
	});

	radios = ui.forms.radiobuttons('doc', values, onchange);

	fileSelection.appendChild(radios.fragment);

	current = {
		relPath: relPath,
		fileName: activeFileName
	};

	if (activeFileName) {
		renderDoc(relPath, activeFileName);

		radios.inputs[stripFileName(activeFileName)].setAttribute('checked', 'checked');
	}
}


function createNavigator(path) {
	return function () {
		setNode(path);
	};
}

var items = [
	{ name: 'Start', cb: createNavigator('/') },
	{ name: 'MAGE', cb: createNavigator('/node_modules/mage') },
	{ name: 'Dependencies', cb: createNavigator('/node_modules') }
];

function setup(cb) {
	mage.dashboard.getDocTree(function (error, tree) {
		if (error) {
			ui.notifications.send('Error while loading documentation');
			return cb(error);
		}

		currentTree = tree;

		// set the sidebar menu

		ui.sidebar.setPageMenu('docs', items);

		cb();
	});
}


// what to do when the route changes

var hasSetup = false;

ui.router.listen(/^docs$/, function () {
	if (!hasSetup) {
		hasSetup = true;

		setup(function () {
			// open the first item

			items[0].li.click();
		});
	}

	if (current.relPath) {
		var fullPath = pathJoin(current.relPath, current.fileName);

		if (fullPath[0] !== '/') {
			fullPath = '/' + fullPath;
		}

		ui.router.replace('docs' + fullPath);
	}
});

ui.router.listen(/^docs(\/.+?)$/, function (match) {
	if (hasSetup) {
		return renderFullPath(match[1]);
	}

	hasSetup = true;

	setup(function () {
		renderFullPath(match[1]);
	});
});
