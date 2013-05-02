(function (window) {

	var mage = window.mage;
	var Tome = window.Tome;


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
		var type = typeof value;

		var span = document.createElement('span');
		span.className = type;
		span.textContent = this._stringify(value);

		if (parent && !property) {
			// this is a property name, we don't allow editing

			return span;
		}

		span.onclick = function () {
			span.setAttribute('contenteditable', 'true');

			span.focus();
		};

		span.onblur = function () {
			span.setAttribute('contenteditable', 'false');

			try {
				value = JSON.parse(span.textContent);
				type = typeof value;
				span.className = type;

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
				alert(err);
			}

			span.textContent = that._stringify(value);
		};

		return span;
	};


	JsonRenderer.prototype._any = function (level, value, parent, property) {
		if (Array.isArray(value)) {
			return this._array(level, value);
		}

		if (typeof value === 'object' && value !== null) {
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
		var type = Tome.typeOf(value);

		var span = document.createElement('span');
		span.className = type;
		span.textContent = this._stringify(value);

		if (!Tome.isTome(value)) {
			// this happens for example on property names

			return span;
		}

		span.onclick = function () {
			span.setAttribute('contenteditable', true);

			span.focus();
		};

		span.onblur = function () {
			span.setAttribute('contenteditable', false);

			try {
				var newValue = Tome.conjure(JSON.parse(span.textContent));
				type = Tome.typeOf(value);
				span.className = type;

				value.assign(newValue);

				if (that.onchange) {
					that.onchange(that.doc);
				}
			} catch (err) {
				alert(err);
			}

			span.textContent = that._stringify(value);
		};

		return span;
	};


	TomeRenderer.prototype._any = function (level, value) {
		var type = Tome.typeOf(value);

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


	mage.dashboard.ui.DocEditor = DocEditor;

}(window));
