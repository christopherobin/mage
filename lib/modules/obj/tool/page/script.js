$html5client('module.obj');

(function (window) {
	var mithril = window.mithril;
	var classMap = {};
	var curObjClass = null;
	var dialogType = null;

	function appendObjClass(objClass) {
		classMap[objClass.id] = objClass;

		var li     = $('<li class="objClassHolder" data-id="' + objClass.id + '"></li>');
		var button = $('<button class="editObjClassDialog" data-id="' + objClass.id + '">Edit</button>');

		var delBtn = '<button class="delObjClassBtn" data-id="' + objClass.id + '">X</button>';
		li.append(button).append(((objClass.data && objClass.data.name) ? objClass.data.name : objClass.name) + delBtn);
//		li.append(button).append(((objClass.data && objClass.data.name) ? objClass.data.name : objClass.name));

		$('#objClassList').append(li);
	}


	function buildData(oldData) {
		var data = {};
		for (var prop in oldData) {
			var propData = oldData[prop];

			if (propData.lang !== undefined) {
				console.log('wtf??', propData)
				propData = propData.val;
			}

			data[prop] = propData;
		}

		return data;
	}


	function generatePropField(attr, type, data) {
		var input = '';
		var prop = '<div class="propName">' + attr + '<button class="removeProperty removeBtn">X</button></div>';

		input += '<div class="dataField" data-id="' + attr + '">';

		switch (type) {
			case 'number':
				input += prop + ' <input type="number" data-type="number" data-property="';
				input += attr + '" value="' + data + '" />';
				break;

			case 'string':
				input += prop + ' <input type="text" data-type="string" data-property="';
				input += attr + '" value="' + data + '" />';
				break;

			case 'boolean':
				input += prop + '<input type="checkbox" data-type="bool" data-property="';
				input += attr + '" ' + ((data) ? 'checked' : '') + ' />';
				break;

			case 'object':
				input +=  prop + '<textarea rows="4" cols="55" data-type="object" data-property="' + attr + '">';
				input += JSON.stringify(data) + '</textarea>';
				break;

			default:
				break;
		}

		input += '</div>';

		return input;
	}



	function getParams(dialog) {
		var params = {};
		dialog.find('.dataValues input, .dataValues textarea').each(function () {
			var property = $(this).attr('data-property');
			var type     = $(this).attr('data-type');
			var value    = $(this).val();
			switch (type) {
				case 'number':
					params[property] = parseInt(value, 10);
					break;

				case 'object':
					params[property] = JSON.parse(value);
					break;

				case 'bool':
					params[property] = $(this).is(':checked');
					break;

				case 'string':
				default:
					var lang = $(this).attr('data-language') || '';
					params[property] = { val: value, lang: lang };
					break;
			}
		});

		return params;
	}


	function editObjClass() {
		var dialog   = $('#editObjClassDialog');
		var data     = getParams(dialog);
		var objClass = classMap[curObjClass];

		mithril.obj.editClass(curObjClass, objClass.name, objClass.weight, data, function (error) {
			var msg;

			if (error) {
				msg = $('<div class="error" style="display: none;">Error on Save!</div>');
			} else {
				msg = $('<div class="updated" style="display: none;">Saved!</div>');
			}

			dialog.append(msg);
			msg.toggle(300);
			setTimeout(function() {
				msg.toggle(300);
				msg.remove();
			}, 4500);
		});
	}


	function addObjClass() {
		var dialog = $('#addObjClassDialog');
		var data   = getParams(dialog);
		var name   = dialog.find('.name').val();
		var weight = dialog.find('.weight').val();
		var obj    = {
			name: name,
			weight: weight,
			data: buildData(data)
		};

		mithril.obj.addClass(name, weight, data, function (error, id) {
			if (error) {
				return console.error('Could not add object class.');
			}

			obj.id = id;
			classMap[id] = obj;
			appendObjClass(obj);

			dialog.dialog('close');
		});
	}


	function loadObjClassDialog(id) {
		dialogType = 'edit';
		var objClass = classMap[id];
		var data     = objClass.data;
		var fields = '';

		if (data) {
			for (var property in data) {
				var type = typeof data[property];
				fields += generatePropField(property, type, data[property]);
			}
		}


		$('#editObjClassDialog .dataValues').empty();
		$('#editObjClassDialog .dataValues').append(fields);
	}

	function setupHandlers() {
		$('.addProperty').live('click', function (e) {
			$('#addPropertyDialog').dialog('open');
		});


		$('.removeProperty').live('click', function (e) {
			$(this).parents('.dataField').remove();
		});


		$('.delObjClassBtn').live('click', function () {
			if (confirm('Are you sure you want to delete this object class?')) {
				var objClass = $(this).parents('.objClassHolder');
				var id = objClass.attr('data-id');
				mithril.obj.delClass(id, function (error) {
					if (!error) {
						objClass.remove();
						delete classMap[id];
					}
				});
			}
		});


		$('.editObjClassDialog').live('click', function () {
			var dlg = $('#editObjClassDialog');
			curObjClass  = $(this).attr('data-id');
			loadObjClassDialog(curObjClass);
			dlg.dialog('open');
		});

		$('.addObjClassBtn').click(function () {
			dialogType = 'add';
			$('#addObjClassDialog').dialog('open');
		});


		$('#addObjClassDialog').dialog({
			autoOpen: false,
			modal: true,
			width: 1180,
			title: 'Add object class...',
			open: function () {
				$(this).find('.dataValues')	.empty();
				$(this).find('.name').val('');
				$(this).find('.weight').val('');
			},
			buttons: [
				{
					text: "Cancel",
					click: function () {
						$(this).dialog('close');
					}
				},
				{
					text: "Add",
					click: function () {
						addObjClass();
					}
				}
			]
		});


		$('#editObjClassDialog').dialog({
			autoOpen: false,
			modal: true,
			width: 1180,
			title: 'Edit object class...',
			buttons: [
				{
					text: "Cancel",
					click: function () {
						$(this).dialog('close');
					}
				},
				{
					text: "Edit",
					click: function () {
						editObjClass();
					}
				}
			]
		});


		$('#addPropertyDialog select').live('change', function (e) {
			var dlg = $(this).parents('#addPropertyDialog');
			var type = $(this).find('option:selected').val();
			dlg.find('.value').hide();
			dlg.find('.value[data-type="' + type + '"]').show();
		});


		$('#addPropertyDialog').dialog({
			autoOpen: false,
			width: 'auto',
			modal: true,
			title: 'Add property...',
			open: function () {
				$(this).find('option[value="number"]').attr('selected', true);
				$(this).find('input, textarea').val('');
				$(this).find('.value').hide();
				$(this).find('.value[data-type="number"]').show();
			},
			buttons: [
				{
					text: 'Cancel',
					click: function () {
						$(this).dialog('close');
					}
				},
				{
					text: 'Add',
					click: function () {
						addProperty();
					}
				}
			]
		});
	}



	function addProperty() {
		var dialog;
		if (dialogType === 'edit') {
			dialog = $('#editObjClassDialog');
		} else {
			dialog = $('#addObjClassDialog');
		}
		var dlg = $('#addPropertyDialog');
		var property = dlg.find('input[data-id="property"]').val();

		if (dialog.find('.dataField[data-id="' + property + '"]').length !== 0) {
			return alert('Property ' + property + ' already exists');
		}

		var type = dlg.find('select[data-id="type"] option:selected').val();
		var value = dlg.find('.value[data-type="' + type + '"] input, .value[data-type="' + type + '"] textarea').val();
		if (type === 'boolean') {
			value = dlg.find('.value[data-type="boolean"] input:checked').length > 0;
		}

		var ele = generatePropField(property, type, value);
		dialog.find('.dataValues').append(ele);
		dlg.dialog('close');
	}

	mithril.loader.on('obj.display', function () {
		if (!window.tool) {
			window.tool = {};
		}


		mithril.setupModules(['actor', 'obj'], function (error) {
			if (error) {
				return console.error(error);
			}


			var classes = mithril.obj.getClassesByName();
			for (var i = 0, len = classes.length; i < len; i++) {
				appendObjClass(classes[i]);
			}

			setupHandlers();
		});

	});
}(window));
