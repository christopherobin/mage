// Tell jshint that we don't mind late definitions, since we have a circular reference between
// setNode and other functions.

/* jshint latedef: false */

var mage = require('mage');

var ui = mage.dashboard.ui;

var elmFileCrawler = document.getElementById('docs_filecrawler');
var elmContent = document.getElementById('docs_content');

var fileCrawler = new ui.classes.FileCrawler();
elmFileCrawler.appendChild(fileCrawler.getContainer());

var current;
var docTree;


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

	var fullPath = pathJoin(current ? current.folderPath : '/', relPath);

	var m = fullPath.match(/^(.*?)([^\/]+?\.(md|mdown|markdown))?$/i);
	if (!m) {
		throw new Error('Invalid path: ' + relPath);
	}

	var folderPath = m[1];
	var fileName = m[2];

	// go into the docTree to find the subpath we're looking for

	var node = docTree;
	var splitPath = folderPath.split('/');

	for (var i = 0; i < splitPath.length; i++) {
		var chunk = splitPath[i];

		if (chunk !== '' && chunk !== '.') {
			if (!node) {
				throw new Error('Folder not found: ' + splitPath.slice(0, i).join('/'));
			}

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
		folderPath: folderPath,
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

		elmContent.innerHTML = rendered;

		// scroll to top

		document.body.scrollIntoView(true);

		// make links work

		var aTags = elmContent.getElementsByTagName('a');
		for (var i = 0, len = aTags.length; i < len; i++) {
			aTags[i].onclick = followLink;
		}

		// add zero clipboard functionality

		var codeNodes = elmContent.querySelectorAll('pre>code,pre>samp');
		for (i = 0; i < codeNodes.length; i++) {
			var node = codeNodes.item(i);

			// add the clip thingy only on mouse hover
			ui.Clipboard.install(node.parentNode);
		}
	});
}


function setNode(resolved) {
	ui.router.set('docs' + resolved.fullPath);

	fileCrawler.select(resolved.folderPath, resolved.fileName);

	if (current && current.fullPath === resolved.fullPath) {
		return;
	}

	current = resolved;

	// start resetting the screen

	elmContent.innerHTML = '';

	// preparation for radio buttons

	if (resolved.fileName) {
		renderDoc(resolved);
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

		// file crawler

		fileCrawler.setTree(tree);

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

		fileCrawler.select(current.folderPath, current.fileName);
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

// what to do when the user selects a file or folder in the file crawler

fileCrawler.on('change', function (folderPath, fileName, fullPath) {
	setNode(resolve(fullPath));
});
