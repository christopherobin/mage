var inherits = require('inherit');
var EventEmitter = require('emitter');
var mage = require('mage');


function FileCrawler(colHeight) {
	EventEmitter.call(this);

	var container;

	this.colHeight = colHeight || 165;
	this.tree = null;
	this.container = container = document.createElement('div');
	this.fileArea = document.createElement('div');

	container.style.overflow = 'scroll';
	container.style.whiteSpace = 'nowrap';

	container.appendChild(this.fileArea);

	this.folderPath = null;
	this.fileName = null;

	this.columns = [];

	// this special mousewheel handler will keep scrolling on columns functional, without
	// having the entire document scroll when you reach the limit of a column.

	container.onmousewheel = function (event) {
		if (event.srcElement.tagName !== 'SPAN') {
			return;
		}

		var x = event.wheelDeltaX;
		var y = event.wheelDeltaY;

		// if there was more horizontal movement, scroll horizontally,
		// else try to scroll the column

		if (Math.abs(x) > Math.abs(y)) {
			container.scrollLeft -= event.wheelDeltaX;
		} else {
			var column = event.srcElement.parentElement;

			column.scrollTop -= y;
		}

		// prevent scrolling on document from happening

		event.preventDefault();
	};
}


inherits(FileCrawler, EventEmitter);


function createItem(name, icon, onclick) {
	var span = document.createElement('span');
	span.style.display = 'block';
	span.style.backgroundImage = 'url(' + mage.assets.img(icon) + ')';
	span.style.backgroundRepeat = 'no-repeat';
	span.style.backgroundPosition = '5px center';
	span.style.padding = '0 5px 0 24px';
	span.style.minWidth = '120px';
	span.style.whiteSpace = 'nowrap';

	span.appendChild(document.createTextNode(name));

	if (onclick) {
		span.onclick = function () {
			onclick(name);
		};
	}

	return span;
}

function setItemSelected(item, highlighted) {
	item.elm.style.backgroundColor = highlighted ? '#ef4327' : '#999';
	item.elm.style.color = '#fff';

	item.elm.scrollIntoView(false);
}

function setItemUnselected(item) {
	item.elm.style.backgroundColor = '';
	item.elm.style.color = '';
}

function createFolder(name, onclick) {
	return createItem(name, 'folder_icon', onclick);
}

function createFile(name, onclick) {
	return createItem(name, 'file_icon', onclick);
}


function parsePath(str) {
	return str.split('/').filter(function (chunk) {
		return chunk.length > 0;
	});
}

function makePath(arr) {
	return '/' + arr.join('/');
}


FileCrawler.prototype.setTree = function (tree) {
	this.tree = tree;
};


FileCrawler.prototype.getContainer = function () {
	return this.container;
};


FileCrawler.prototype.addColumn = function (parsedPath, treeNode) {
	var div = document.createElement('div');
	div.style.display = 'inline-block';
	div.style.overflowY = 'scroll';
	div.style.maxHeight = this.colHeight + 'px';
	div.style.verticalAlign = 'top';
	div.style.padding = '0 5px';
	div.style.resize = 'none';

	if (this.columns.length > 0) {
		div.style.borderLeft = '1px solid #ccc';
	}

	var that = this;
	var items = [], item;

	function navIntoFolder(childFolderName) {
		that.select(makePath(parsedPath.concat(childFolderName)), null);
	}

	function activateFile(fileName) {
		that.select(makePath(parsedPath), fileName);
	}


	var folderNames = Object.keys(treeNode.folders || {}).sort();
	var fileNames = (treeNode.files || []).slice().sort();

	for (var i = 0; i < folderNames.length; i++) {
		item = createFolder(folderNames[i], navIntoFolder);

		items.push({
			name: folderNames[i],
			elm: item,
			type: 'folder'
		});

		div.appendChild(item);
	}

	for (i = 0; i < fileNames.length; i++) {
		var fileName = fileNames[i];

		item = createFile(fileName, activateFile);

		items.push({
			name: fileName,
			elm: item,
			type: 'file'
		});

		div.appendChild(item);
	}

	var column = {
		parsedPath: parsedPath,
		folderPath: makePath(parsedPath),
		treeNode: treeNode,
		elm: div,
		items: items
	};

	this.columns.push(column);

	this.fileArea.appendChild(div);

	return column;
};


FileCrawler.prototype.select = function (folderPath, fileName) {
	fileName = fileName || null;

	if (this.folderPath === folderPath && this.fileName === fileName) {
		return;
	}

	this.folderPath = folderPath;
	this.fileName = fileName;

	var treeNode = this.tree;
	var parsedPath = parsePath(folderPath);

	var fullPath = '/' + parsedPath.concat(fileName).join('/');

	this.emit('change', this.folderPath, this.fileName, fullPath);

	// The emission of the change event might have triggered another call to select().
	// This happens for example when a folder is selected, but that should auto-select a default
	// file inside that folder. In that case, this.folderPath and/or this.fileName will no longer
	// equal folderPath and fileName. We can simply return, because the next call has taken over.

	if (this.folderPath !== folderPath || this.fileName !== fileName) {
		return;
	}

	function removeColumn(col) {
		col.elm.parentNode.removeChild(col.elm);
	}

	for (var i = 0; treeNode || this.columns[i]; i++) {
		var folderName = parsedPath[i - 1];
		var selected = parsedPath[i] || fileName;

		var column = this.columns[i];

		if (column && column.parsedPath[i - 1] !== folderName) {
			// destroy all columns from this point

			this.columns.splice(i).forEach(removeColumn);

			column = null;
		}

		if (!column && treeNode) {
			column = this.addColumn(parsedPath.slice(0, i), treeNode);
		}

		if (column) {
			// select the right item

			for (var j = 0; j < column.items.length; j++) {
				var item = column.items[j];

				if (item.name === selected) {
					var isLastInTree = (item.type === 'file' || (!fileName && item.type === 'folder' && !parsedPath[i + 1]));

					setItemSelected(item, isLastInTree);
				} else {
					setItemUnselected(item);
				}
			}
		}

		if (parsedPath[i] && treeNode) {
			treeNode = treeNode.folders[parsedPath[i]];
		} else {
			treeNode = null;
		}
	}

	// scroll to the far right

	var lastColumn = this.columns[this.columns.length - 1];
	if (lastColumn) {
		lastColumn.elm.scrollIntoView(false);
	}
};


module.exports = FileCrawler;
