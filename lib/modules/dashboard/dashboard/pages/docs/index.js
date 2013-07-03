// Tell jshint that we don't mind late definitions, since we have a circular reference between
// setNode and other functions.

/* jshint latedef: false */

var mage = require('mage');

var folderSelection = document.getElementById('docs_folders');
var fileSelection = document.getElementById('docs_files');
var content = document.getElementById('docs_content');
var path = document.getElementById('docs_path');

var ui = mage.dashboard.ui;

var current;
var docTree;


function stripFileExt(fileName) {
	var index = fileName.lastIndexOf('.');
	return (index === -1) ? fileName : fileName.substr(0, index);
}


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


function resolve(relPath) {
	// relPath may contain the filename as well
	// the path is considered to be relative to the path we are currently in

	var fullPath = pathJoin(current ? current.folderName : '/', relPath);

	var m = fullPath.match(/^(.*?)([^\/]+?\.(md|mdown|markdown))?$/i);
	if (!m) {
		return console.error('Invalid path:', relPath);
	}

	var folderName = m[1];
	var fileName = m[2];

	// go into the docTree to find the subpath we're looking for

	var node = docTree;
	var splitPath = folderName.split('/');

	for (var i = 0; i < splitPath.length; i++) {
		var chunk = splitPath[i];

		if (chunk !== '' && chunk !== '.') {
			node = node.folders[chunk];
		}
	}

	if (!node) {
		throw new Error('Could not find path: ' + fullPath);
	}

	// figure out the filename if we weren't given one

	for (i = 0; !fileName && i < node.files.length; i++) {
		if (node.files[i].match(/README/i)) {
			fileName = node.files[i];
			fullPath = pathJoin(fullPath, fileName);
		}
	}

	return {
		node: node,
		fullPath: fullPath,  // contains the fileName
		folderName: folderName,
		fileName: fileName
	};
}


function followLink(event) {
	var href = this.getAttribute('href');

	if (href.match(/^https?:/)) {
		// link to a website

		window.open(href, '_blank').focus();
	} else {
		// link to another document

		setNode(resolve(href));
	}

	event.preventDefault();

	return false;
}


function renderDoc(resolved) {
	mage.dashboard.renderDoc(resolved.fullPath, function (error, rendered) {
		if (error) {
			return ui.notifications.send('Error rendering documentation');
		}

		content.innerHTML = rendered;

		document.body.scrollIntoView(true);

		// make links work

		var aTags = content.getElementsByTagName('a');
		for (var i = 0, len = aTags.length; i < len; i++) {
			aTags[i].onclick = followLink;
		}
	});
}


function setNode(resolved) {
	if (current && current.fullPath === resolved.fullPath) {
		return;
	}

	current = resolved;

	ui.router.set('docs' + resolved.fullPath);

	// start resetting the screen

	folderSelection.textContent = 'Folder: ';
	fileSelection.textContent = 'Document: ';
	content.innerHTML = '';
	path.textContent = 'Current folder: ' + resolved.folderName;

	// preparation for radio buttons

	function onchange(value) {
		value.click();
	}

	function makeRadio(name, resolvedTarget) {
		return {
			toString: function () {
				return name;
			},
			click: function () {
				setNode(resolvedTarget);
			}
		};
	}

	function makeFolderRadio(folderName) {
		return makeRadio(folderName, resolve(folderName));
	}

	function makeFileRadio(fileName) {
		return makeRadio(stripFileExt(fileName), resolve(fileName));
	}

	// create all radio buttons

	var folderNames = Object.keys(resolved.node.folders || {});
	var fileNames = resolved.node.files;

	var folderValues = folderNames.map(makeFolderRadio);
	var fileValues = fileNames.map(makeFileRadio);

	if (resolved.folderName.length > 1) {
		folderValues.unshift(makeFolderRadio('..'));
	}

	var folderRadios = ui.forms.radiobuttons('folder', folderValues, onchange);
	var fileRadios = ui.forms.radiobuttons('doc', fileValues, onchange);

	folderSelection.appendChild(folderRadios.fragment);
	fileSelection.appendChild(fileRadios.fragment);

	if (resolved.fileName) {
		renderDoc(resolved);

		fileRadios.inputs[stripFileExt(resolved.fileName)].setAttribute('checked', 'checked');
	}
}


function createNavigator(path) {
	return function () {
		setNode(resolve(path));
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
			ui.notifications.send('Error while loading documentation tree');
			return cb(error);
		}

		docTree = tree;

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

	if (current && current.fullPath) {
		ui.router.replace('docs' + current.fullPath);
	}
});

ui.router.listen(/^docs(\/.*)$/, function (match) {
	if (hasSetup) {
		return setNode(resolve(match[1]));
	}

	hasSetup = true;

	setup(function () {
		setNode(resolve(match[1]));
	});
});
