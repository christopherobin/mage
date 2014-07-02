// Tell jshint that we don't mind late definitions, since we have a circular reference between
// setNode and other functions.

/* jshint latedef: false */

var mage = require('mage');
var mageLoader = require('loader');

var page = mageLoader.renderPage('docs');
page.innerHTML = require('./page.html');

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

	var m = fullPath.match(/^((.*?)([^\/]+?\.(md|mdown|markdown))?)(#.*)?$/i);
	if (!m) {
		throw new Error('Invalid path: ' + relPath);
	}

	var folderPath = m[2];
	var fileName = m[3];
	var anchor = m[5] ? m[5].substring(1) : false;

	// remove the anchor from the fullPath
	fullPath = m[1];

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
		fileName: fileName,
		anchor: anchor
	};
}


function followLink(event) {
	event.preventDefault();

	var href = this.getAttribute('href');

	if (href.match(/^https?:/)) {
		// link to a website

		window.open(href, '_blank').focus();
	} else {
		// link to another document

		setNode(resolve(href));
	}
}


function renderDoc(resolved) {
	mage.dashboard.renderDoc(resolved.fullPath, function (error, rendered) {
		if (error) {
			return ui.notifications.send('Error rendering documentation');
		}

		elmContent.innerHTML = rendered;

		// scroll to top if no anchor present
		if (!resolved.anchor) {
			document.body.scrollIntoView(true);
		}

		// make links work

		var aTags = elmContent.getElementsByTagName('a');
		for (var i = 0, len = aTags.length; i < len; i++) {
			aTags[i].onclick = followLink;
		}

		// add zero clipboard functionality

		var codeNodes = elmContent.querySelectorAll('pre>code,pre>samp');
		for (i = 0; i < codeNodes.length; i++) {
			var node = codeNodes.item(i);

			// install the clipboard component on that node
			ui.clipboard.install(node.parentNode);
		}

		// add anchors to h*
		var titles = {};
		function urlify(string) {
			var base = string.toLowerCase().replace(/[^a-z0-9_]+/g, '-').replace(/(^-|-$)/g, '');
			var titleUrl = base;

			// if that entry exists we are hitting a duplicate title, append the incremented number
			// stored in "titles"
			if (titles[base]) {
				titleUrl += '-' + titles[base];
			}

			// increment generated title's count
			titles[base] = titles[base] ? titles[base] + 1 : 1;

			return 'link-' + titleUrl;
		}

		var titleNodes = elmContent.querySelectorAll('h1,h2,h3,h4,h5,h6');
		for (i = 0; i < titleNodes.length; i++) {
			var titleNode = titleNodes.item(i);

			// add the link
			// <a name="bugfixes-1" class="anchor" href="#bugfixes-1"><span class="octicon octicon-link"></span></a>
			var link = document.createElement('a');
			var title = urlify(titleNode.textContent);
			link.href = '#docs' + resolved.fullPath + '#' + title;
			link.className = 'doc_anchor';
			link.id = title;

			// image
			var img = document.createElement('img');
			img.src = mage.assets.img('link_icon');
			link.appendChild(img);

			// insert it in the header
			titleNode.insertBefore(link, titleNode.firstChild);
		}

		// if we have an anchor, scroll there
		if (resolved.anchor) {
			var anchor = document.getElementById(resolved.anchor);
			if (anchor) {
				anchor.parentElement.scrollIntoView(true);
			}
		}
	});
}


function setNode(resolved) {
	var route = 'docs' + resolved.fullPath;
	if (resolved.anchor) {
		route += '#' + resolved.anchor;
	}

	ui.router.set(route);

	fileCrawler.select(resolved.folderPath, resolved.fileName, false);

	if (current && current.fullPath === resolved.fullPath) {
		// check if anchor changed
		if (resolved.anchor && (current.anchor !== resolved.anchor)) {
			// navigate to anchor
			var anchor = document.getElementById(resolved.anchor);
			if (anchor) {
				anchor.parentElement.scrollIntoView(true);
			}
		}
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

		setup(function (error) {
			if (error) {
				hasSetup = false;
				return;
			}

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
