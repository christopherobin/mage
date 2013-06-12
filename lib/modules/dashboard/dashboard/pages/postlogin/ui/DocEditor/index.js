var mage = require('mage');


// JSON

function JsonRenderer() {
	this.className = 'json';
	this.doc = undefined;
	this.onchange = undefined;
	this.modes = {
		rich: 'Rich',
		raw: 'Raw'
	};
}


JsonRenderer.prototype._stringify = function (value) {
	return JSON.stringify(value, null, '  ');
};


JsonRenderer.prototype._text = function (str, indentLevel) {
	if (indentLevel > 0) {
		str = (new Array(indentLevel + 1)).join('  ') + str;
	}

	return document.createTextNode(str);
};


JsonRenderer.prototype._typeof = function (value) {
	if (value === null) {
		return 'null';
	}

	if (Array.isArray(value)) {
		return 'array';
	}

	return typeof value;
};


JsonRenderer.prototype._object = function (level, value) {
	var frag = document.createDocumentFragment();

	frag.appendChild(this._text('{\n'));
	frag.appendChild(this._text('', level + 1));

	var keys = Object.keys(value);

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];

		frag.appendChild(this._json(key, value));
		frag.appendChild(this._text(': '));
		frag.appendChild(this._any(level + 1, value[key], value, key));

		if (i < keys.length - 1) {
			frag.appendChild(this._text(',\n'));
			frag.appendChild(this._text('', level + 1));
		} else {
			frag.appendChild(this._text('\n'));
			frag.appendChild(this._text('}', level));
		}
	}

	return frag;
};


JsonRenderer.prototype._array = function (level, value) {
	var frag = document.createDocumentFragment();

	frag.appendChild(this._text('[\n'));
	frag.appendChild(this._text('', level + 1));

	for (var i = 0; i < value.length; i++) {
		frag.appendChild(this._any(level + 1, value[i], value, i));

		if (i < value.length - 1) {
			frag.appendChild(this._text(',\n'));
			frag.appendChild(this._text('', level + 1));
		} else {
			frag.appendChild(this._text('\n'));
			frag.appendChild(this._text(']', level));
		}
	}

	return frag;
};


JsonRenderer.prototype._json = function (value, parent, property) {
	// generally used for scalar values, but may apply to the entire document for raw mode

	var that = this;

	var span = document.createElement('span');
	span.textContent = this._stringify(value);

	if (parent && !property) {
		// this is a property name, we don't allow editing

		span.className = 'property';

		return span;
	}

	span.className = this._typeof(value);

	span.onclick = function () {
		span.setAttribute('contenteditable', 'true');

		span.focus();

		var lastType = that._typeof(value);

		span.oninput = function () {
			try {
				lastType = span.className = that._typeof(JSON.parse(this.textContent));
			} catch (err) {
				span.className = lastType + ' error';
			}
		};
	};

	span.onblur = function () {
		span.setAttribute('contenteditable', 'false');

		try {
			value = JSON.parse(span.textContent);

			if (parent) {
				if (property) {
					// this value is the value of a property

					parent[property] = value;
				}
			} else {
				that.doc = value;
			}

			if (that.onchange) {
				that.onchange(that.doc);
			}
		} catch (err) {
			mage.dashboard.ui.notifications.send('Syntax error', err);
		}

		span.textContent = that._stringify(value);
		span.className = that._typeof(value);
	};

	return span;
};


JsonRenderer.prototype._any = function (level, value, parent, property) {
	var type = this._typeof(value);

	if (type === 'array') {
		return this._array(level, value);
	}

	if (type === 'object') {
		return this._object(level, value);
	}

	return this._json(value, parent, property);
};


JsonRenderer.prototype.render = function (doc, options) {
	this.doc = doc;

	if (options.mode === 'raw') {
		return this._json(doc);
	}

	return this._any(0, doc);
};


// Tomes

function TomeRenderer() {
	this.Tome = window.Tome;

	this.className = 'tome';
	this.doc = undefined;
	this.onchange = undefined;
	this.modes = {
		rich: 'Rich',
		raw: 'Raw'
	};
}


TomeRenderer.prototype._stringify = function (value) {
	return JSON.stringify(value, null, '  ');
};


TomeRenderer.prototype._text = function (str, indentLevel) {
	if (indentLevel > 0) {
		str = (new Array(indentLevel + 1)).join('  ') + str;
	}

	return document.createTextNode(str);
};


TomeRenderer.prototype._object = function (level, value) {
	var frag = document.createDocumentFragment();

	frag.appendChild(this._text('{\n'));
	frag.appendChild(this._text('', level + 1));

	var keys = Object.keys(value);

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];

		frag.appendChild(this._json(key));
		frag.appendChild(this._text(': '));
		frag.appendChild(this._any(level + 1, value[key]));

		if (i < keys.length - 1) {
			frag.appendChild(this._text(',\n'));
			frag.appendChild(this._text('', level + 1));
		} else {
			frag.appendChild(this._text('\n'));
			frag.appendChild(this._text('}', level));
		}
	}

	return frag;
};


TomeRenderer.prototype._array = function (level, value) {
	var frag = document.createDocumentFragment();

	frag.appendChild(this._text('[\n'));
	frag.appendChild(this._text('', level + 1));

	for (var i = 0; i < value.length; i++) {
		frag.appendChild(this._any(level + 1, value[i]));

		if (i < value.length - 1) {
			frag.appendChild(this._text(',\n'));
			frag.appendChild(this._text('', level + 1));
		} else {
			frag.appendChild(this._text('\n'));
			frag.appendChild(this._text(']', level));
		}
	}

	return frag;
};


TomeRenderer.prototype._json = function (value) {
	// generally used for scalar values, but may apply to the entire document for raw mode

	var that = this;

	var span = document.createElement('span');
	span.textContent = this._stringify(value);

	if (!this.Tome.isTome(value)) {
		// this is a property name, we don't allow editing

		span.className = 'property';

		return span;
	}

	span.className = this.Tome.typeOf(value);

	span.onclick = function () {
		span.setAttribute('contenteditable', true);

		span.focus();

		var lastType = that.Tome.typeOf(value);

		span.oninput = function () {
			try {
				lastType = span.className = that.Tome.typeOf(JSON.parse(this.textContent));
			} catch (err) {
				span.className = lastType + ' error';
			}
		};
	};

	span.onblur = function () {
		span.setAttribute('contenteditable', false);

		try {
			value.assign(JSON.parse(span.textContent));

			if (that.onchange) {
				that.onchange(that.doc);
			}
		} catch (err) {
			mage.dashboard.ui.notifications.send('Syntax error', err);
		}

		span.textContent = that._stringify(value);
		span.className = that.Tome.typeOf(value);
	};

	return span;
};


TomeRenderer.prototype._any = function (level, value) {
	var type = this.Tome.typeOf(value);

	if (type === 'array') {
		return this._array(level, value);
	}

	if (type === 'object') {
		return this._object(level, value);
	}

	return this._json(value);
};


TomeRenderer.prototype.render = function (doc, options) {
	this.doc = doc;

	if (options.mode === 'raw') {
		return this._json(doc);
	}

	return this._any(0, doc);
};


// Plain Text (UNTESTED)

function PlainTextRenderer() {
	this.className = 'text';
	this.onchange = undefined;
	this.modes = {};
}


PlainTextRenderer.prototype.render = function (doc) {
	// generally used for scalar values, but may apply to the entire document for raw mode

	var that = this;

	var span = document.createElement('span');
	span.style.display = 'block';
	span.style.minHeight = '20px';
	span.textContent = '' + doc;

	span.onclick = function () {
		span.setAttribute('contenteditable', true);

		span.focus();
	};

	span.onblur = function () {
		span.setAttribute('contenteditable', false);

		doc = span.textContent;

		if (that.onchange) {
			that.onchange(doc);
		}
	};

	return span;
};


// Editor class

function DocEditor(cnt) {
	this.cnt = cnt;
	this.doc = undefined;
	this.renderer = undefined;
	this.mediaType = undefined;
	this.onchange = undefined;
}


DocEditor.renderers = {
	'application/json': JsonRenderer,
	'application/x-tome': TomeRenderer,
	'text/plain': PlainTextRenderer
};


DocEditor.prototype.render = function (options) {
	options = options || {};

	if (!options.hasOwnProperty('readOnly')) {
		options.readOnly = false;
	}

	if (!options.hasOwnProperty('raw')) {
		options.raw = false;
	}

	this.cnt.innerHTML = '';
	this.cnt.appendChild(this.renderer.render(this.doc, options));
};


DocEditor.prototype.setDocument = function (doc, mediaType) {
	var that = this;

	// options: { readOnly: true/false, raw: true/false }

	this.clearDocument();

	if (!mediaType) {
		throw new Error('No mediaType given to DocEditor#render()');
	}

	if (this.mediaType !== mediaType) {
		var Renderer = DocEditor.renderers[mediaType];
		if (!Renderer) {
			throw new Error('No renderer found for mediaType: ' + mediaType + '. Supported: ' + Object.keys(DocEditor.renderers));
		}

		this.renderer = new Renderer();

		this.cnt.className = this.renderer.className;

		this.renderer.onchange = function (doc) {
			that.doc = doc;

			if (that.onchange) {
				that.onchange(doc);
			}
		};
	}

	this.doc = doc;

	return this.renderer.modes;
};


DocEditor.prototype.clearDocument = function () {
	this.doc = undefined;
	this.renderer = undefined;
	this.mediaType = undefined;
	this.cnt.innerHTML = '';
};


DocEditor.prototype.getDocument = function () {
	return this.doc;
};

module.exports = DocEditor;