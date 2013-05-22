var mage = require('mage');
var mageLoader = require('loader');

var DocEditor = require('DocEditor');

//
mage.useModules(require, 'archivist');


mageLoader.renderPage('archivist');

var frmSearch = document.getElementById('frm_archivist_search');
var cntTopic = document.getElementById('cnt_archivist_search_topic');
var cntIndex = document.getElementById('cnt_archivist_search_index');
var tblResults = document.getElementById('archivist_search_results');
var docviewTitle = document.getElementById('archivist_docview_title');
var docview = document.getElementById('archivist_docview');
var doceditOptions = document.getElementById('archivist_docedit_options');
var syntaxOptions = document.getElementById('archivist_docedit_options_syntax');
var btnSave = document.getElementById('archivist_docedit_save');

var docEditor = new DocEditor(docview);

var notifications = mage.dashboard.ui.notifications;

// set up syntax modes for the doc editor

var editorOptions = { mode: undefined };


function reset() {
	tblResults.style.display = 'none';
	docview.style.display = 'none';
	docviewTitle.style.display = 'none';
	doceditOptions.style.display = 'none';

	var inps = cntIndex.querySelectorAll('input[type="text"]');
	for (var i = 0; i < inps.length; i++) {
		inps[i].value = '';
	}

	return false;
}

reset();


// render logic

function renderIndex(cfg) {
	if (!cfg || !cfg.index || cfg.index.length === 0) {
		cntIndex.style.display = 'none';
		return;
	}

	var inps = [];
	var firstId;

	for (var i = 0; i < cfg.index.length; i++) {
		var field = cfg.index[i];
		var id = 'archivist_search_index_' + field;
		var name = 'index:' + field;

		inps.push('<div><label for="' + id + '">' + field + '</label>: <input type="text" id="' + id + '" name="' + name + '"></input></div>');

		if (!firstId) {
			firstId = id;
		}
	}

	cntIndex.innerHTML = inps.join('\n');
	cntIndex.style.display = '';

	if (firstId) {
		document.getElementById(firstId).focus();
	}
}


function renderTopics(topics) {
	// generate topic selection

	cntTopic.innerHTML = '';

	function clicked() {
		renderIndex(topics[this.value]);
		return true;
	}

	var first;

	for (var topic in topics) {
		if (topics.hasOwnProperty(topic)) {
			var radio = document.createElement('input');
			radio.type = 'radio';
			radio.name = 'topic';
			radio.value = topic;
			radio.id = 'topicradio:' + topic;

			radio.onclick = clicked;

			var label = document.createElement('label');
			label.setAttribute('for', radio.id);
			label.textContent = topic;

			cntTopic.appendChild(radio);
			cntTopic.appendChild(label);

			if (!first) {
				first = radio;
			}
		}
	}

	if (first) {
		first.click();
	}
}


function openDocument(topic, index) {
	btnSave.disabled = true;

	mage.archivist.getValue(topic, index, { mediaTypes: ['application/x-tome', 'application/json', 'text/plain'] }, function (error, value) {
		var subtitle = [];

		for (var key in index) {
			if (index.hasOwnProperty(key)) {
				subtitle.push(key + ': ' + index[key]);
			}
		}

		var title = subtitle.length === 0 ? topic : topic + ' (' + subtitle.join(', ') + ')';

		docviewTitle.textContent = title;
		docviewTitle.style.display = '';

		if (error) {
			notifications.send('Error retrieving document');
			return;
		}

		var modes = docEditor.setDocument(value.data, value.mediaType);
		docEditor.render(editorOptions);

		function syntaxModeChange() {
			editorOptions.mode = this.value;
			docEditor.render(editorOptions);
		}

		if (Object.keys(modes).length === 0) {
			syntaxOptions.style.display = 'none';
		} else {
			syntaxOptions.textContent = 'Syntax: ';

			var first;

			for (var mode in modes) {
				var radio = document.createElement('input');
				radio.type = 'radio';
				radio.name = 'syntaxmode';
				radio.value = mode;
				radio.id = 'syntaxmode:' + mode;

				radio.onclick = syntaxModeChange;

				if (!first) {
					first = radio;
				}

				var label = document.createElement('label');
				label.setAttribute('for', radio.id);
				label.textContent = modes[mode];

				syntaxOptions.appendChild(radio);
				syntaxOptions.appendChild(label);
			}

			syntaxOptions.style.display = '';

			first.click();
		}

		doceditOptions.style.display = '';
		docview.style.display = '';

		btnSave.form.onsubmit = function () {
			mage.archivist.set(value.topic, value.index, docEditor.getDocument(), value.mediaType, 'live');

			mage.archivist.distribute(function (error) {
				if (error) {
					notifications.send('Error while saving', 'Topic: ' + value.topic);
				} else {
					notifications.send('Saved', 'Topic: ' + value.topic);
				}

				btnSave.disabled = true;
			});

			return false;
		};
	});
}


function search(topic, partialIndex, indexFields) {
	// some core render logic

	tblResults.style.display = 'none';
	var thead = tblResults.tHead;
	var tbody = tblResults.tBodies[0];
	var tfoot = tblResults.tFoot;
	var i;

	var cols = ['#'].concat(indexFields);

	var colCount = cols.length;

	thead.innerHTML = '<tr><th>' + cols.join('</th><th>') + '</th></tr>';
	tbody.innerHTML = '';
	tfoot.innerHTML = '';

	var rowNum = 0;

	function addRow(index) {
		var tr = document.createElement('tr');
		rowNum += 1;

		var cols = [rowNum];

		for (var j = 0; j < indexFields.length; j++) {
			cols.push(index[indexFields[j]]);
		}

		tr.innerHTML = '<td>' + cols.join('</td><td>') + '</td>';

		tr.onclick = function () {
			openDocument(topic, index);
		};

		tbody.appendChild(tr);
	}

	function writeToFooter(text) {
		// TODO: escape this text

		tfoot.innerHTML = '<tr><td colspan="' + colCount + '">' + text + '</td></tr>';
	}

	docviewTitle.textContent = topic;


	// check if this really is a partial search, if not we can go straight to the document

	var isPartial = false;

	for (i = 0; i < indexFields.length; i++) {
		if (!partialIndex.hasOwnProperty(indexFields[i])) {
			isPartial = true;
			break;
		}
	}

	if (!isPartial) {
		tblResults.style.display = '';

		addRow(partialIndex);
		openDocument(topic, partialIndex);
		writeToFooter('1 result');
		return;
	}


	mage.archivist.rawList(topic, partialIndex, {}, function (error, results) {
		docviewTitle.style.display = '';
		docview.style.display = 'none';

		tblResults.style.display = '';

		if (error) {
			return notifications.send('Error while loading', 'Topic: ' + topic);
		}

		if (!results || results.length === 0) {
			return writeToFooter('No results');
		}

		results.forEach(addRow);

		writeToFooter(results.length === 1 ? '1 result' : results.length + ' results');
		docEditor.clearDocument();
	});
}


function setupSearchButton(topics) {
	function submit() {
		var radio = cntTopic.querySelector('input[type="radio"]:checked');

		var topic = radio ? radio.value : null;
		if (!topic) {
			return false;
		}

		var inps = cntIndex.getElementsByTagName('input');
		var partialIndex = {};

		for (var i = 0; i < inps.length; i++) {
			var inp = inps[i];
			var name = inp.name || '';
			var m = name.match(/^index:(.+)$/);

			if (m && inp.value.length > 0) {
				partialIndex[m[1]] = inp.value;
			}
		}

		search(topic, partialIndex, topics[topic].index || []);

		return false;
	}

	frmSearch.onsubmit = submit;
	frmSearch.onreset = reset;
}


function setupDocView() {
	btnSave.disabled = true;

	docEditor.onchange = function () {
		btnSave.disabled = false;
	};
}

mageLoader.once('archivist.display', function () {
	frmSearch.onsubmit = function () {
		return false;
	};

	mage.archivist.getTopics(function (error, topics) {
		if (error) {
			return notifications.send('Error while loading topics');
		}

		renderTopics(topics);
		setupSearchButton(topics);
		setupDocView();
	});
});