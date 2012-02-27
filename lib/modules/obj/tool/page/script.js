$html5client('module.obj');

(function (window) {
	var mod         = {};
	window.tool.obj = mod;

	var mithril      = window.mithril;
	var classMap     = {};
	var classNameMap = {};
	var curObjClass  = null;
	var setup        = false;
	var addDialog    = null;
	var editDialog   = null;
	var curActor     = null;

	mod.addPropertyDialog = null;


	if (!setup) {
		setup = true;
		mithril.loader.renderPage('obj');

		addDialog  = $('#addObjClassDialog');
		editDialog = $('#editObjClassDialog');

		mithril.setupModules(['actor', 'obj'], function (error) {
			if (error) {
				return console.error(error);
			}

			var classes = mithril.obj.getClassesByName();
			var objHtml = '';

			for (var i = 0, len = classes.length; i < len; i++) {
				var objClass = classes[i];
				appendObjClass(objClass);
				objHtml += '<option value="' + objClass.name + '">' + ((objClass.data && objClass.data.name) ? objClass.data.name : objClass.name) + '</option>';
			}

			$('#addActorObjDialog select').append(objHtml);

			setupHandlers();
		});
	}


	function getObjData(cb) {
		cb(null, data);
	}


	function addObjectToPlayer(actorId, collectionId, name, weight, tags, quantity) {
		mithril.obj.addObjectToPlayer(actorId, collectionId, name, weight, tags, quantity, function (error, objIds) {
			if (error) {
				return console.warn('Could not add item ' + name + ' to player ' + actorId);
			}

			var objMap  = curActor.items.objectsMap;
			var members = [];

			for (var i = 0, len = objIds.length; i < len; i++) {
				var id = objIds[i];
				members.push({ id: id });
				objMap[id] = { id: id, name: name };
			}

			var html = generateObjectsHtml(members, objMap);
			$('.playerObjects[data-id="' + curCollection + '"]').append(html);
			$('#addActorObjDialog').dialog('close');
		});
	}


	function generateCollectionsHtml() {
		var actorId = curActor.actorId;
		var items   = curActor.items || {};
		var html = '';
		var collections = items && items.collections || {};

		for (var col in collections) {
			var collection = collections[col];

			// if the owner is the player, display
			if (~~collection.owner === ~~actorId) {
				var objectHtml = generateObjectsHtml(collection.members, items.objectsMap);

				html += '<div class="playerCollection"><div class="collectionType">' + collection.type + '</div>';
				html += '<div class="playerObjects" data-id="' + collection.id + '">' + objectHtml + '</div>';
				html += '<br /><button class="addActorObjBtn" data-collection="' + collection.id + '">Add Object</button></div>';
			}
		}

		return html;
	}

	function generateObjectsHtml(members, objMap) {
		var html = '';

		for (var i = 0, len = members.length; i < len; i++) {
			var objId    = members[i].id;
			var obj      = objMap[objId];
			var objClass = classNameMap[obj.name];

			if (!obj) {
				return console.warn('Member object not found in objects list : ', members[i]);
			}

			if (!objClass) {
				return console.warn('Object not found in object definitions : ', obj.name, ' Object has possibly been removed, but player still owns a copy of the object');
			}

			html += '<div class="collectionObject" data-id="' + objId + '">';
			html += ((objClass && objClass.data && objClass.data.name) ? objClass.data.name : obj.name);
			html += '<button class="removeActorObjBtn" data-id="' + objId + '">X</button>';
			html += '</div>';
		}

		return html;
	}


	function loadActorObjDialog(actorId) {
		var dialog = $('#actorObjDialog');
		$('#actorObjCollections').empty();

		mithril.obj.getFullCollectionsByPlayer(actorId, function (error, items) {
			if (error) {
				return console.warn('Could not retrieve item data');
			}

			curActor = {
				actorId: actorId
			};

			// create a map of objects for quick lookup
			var objMap = {};
			var objs = items && items.objects || [];
			for (var i = 0, len = objs.length; i < len; i++) {
				objMap[objs[i].id] = objs[i];
			}


			if (items) {
				curActor.items = {
					collections: items.collections || {},
					objectsMap: objMap
				};
			}


			var itemFields = generateCollectionsHtml();
			$('#actorObjCollections').append(itemFields);
		});
	}


	function manageActorObjData(actorId) {
		var dialog = $('#actorObjDialog');
		loadActorObjDialog(actorId);
		dialog.dialog('open');
	}


	var extensions = [
		{
			type: 'data',
			target: 'objClass',
			name: 'obj',
			extendFn: getObjData
		},
		{
			type: 'dataManager',
			target: 'actorData',
			name: 'obj',
			extendFn: manageActorObjData
		}
	];


	mithril.gm.extend(extensions, function (error) {
		if (error) {
			console.warn('Module obj could not extend.');
		}
	});


	function appendObjClass(objClass) {
		classMap[objClass.id] = objClass;
		classNameMap[objClass.name] = objClass;

		var li     = $('<li class="objClassHolder" data-id="' + objClass.id + '"></li>');
		var button = $('<button class="editObjClassDialog" data-id="' + objClass.id + '">Edit</button>');

		var delBtn  = '<button class="delObjClassBtn" data-id="' + objClass.id + '">X</button>';
		var display = objClass.name + ((objClass.data && objClass.data.name) ? ' <span>' + objClass.data.name + '</span>' : '');
		li.append(button).append(display + delBtn);
//		li.append(button).append(((objClass.data && objClass.data.name) ? objClass.data.name : objClass.name));

		$('#objClassList').append(li);
	}


	function buildData(oldData) {
		var data = {};
		for (var prop in oldData) {
			var propData = oldData[prop];

			if (propData.lang !== undefined) {
				propData = propData.val;
			}

			data[prop] = propData;
		}

		return data;
	}


	function editObjClass() {
		var dialog   = $('#editObjClassDialog');
		var data     = window.tool.functions.getParams(dialog);
		var objClass = classMap[curObjClass];

		mithril.obj.editClass(curObjClass, objClass.name, objClass.weight, data, function (error) {
			var msg;

			if (error) {
				msg = $('<span class="error" style="display: none;">Error on Save!</span>');
			} else {
				msg = $('<span class="updated" style="display: none;">Saved!</span>');
			}

			dialog.dialog('close');
			classMap[curObjClass].data = buildData(data);
			$('.objClassHolder').append(msg);
			msg.toggle(300);
			setTimeout(function() {
				msg.toggle(300);
				msg.remove();
			}, 4500);
		});
	}


	function addObjClass() {
		var dialog = $('#addObjClassDialog');
		var data   = window.tool.functions.getParams(dialog);
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
			appendObjClass(obj);

			dialog.dialog('close');
		});
	}


	function loadObjClassDialog(id) {
		mod.addPropertyDialog = editDialog;
		var objClass = classMap[id];
		var data     = objClass.data;
		var fields = '';

		if (data) {
			for (var property in data) {
				var type = typeof data[property];
				fields += window.tool.functions.generatePropField(property, type, data[property]);
			}
		}


		$('#editObjClassDialog .dataValues').empty();
		$('#editObjClassDialog .dataValues').append(fields);
	}

	function setupHandlers() {
		$('.addProperty').live('click', function (e) {
			$('#addPropertyDialog').dialog('open');
		});


		$('.delObjClassBtn').live('click', function () {
			if (confirm('Are you sure you want to delete this object class?')) {
				var objClass = $(this).parents('.objClassHolder');
				var id = objClass.attr('data-id');
				mithril.obj.delClass(id, function (error) {
					if (!error) {
						objClass.remove();
						var obj = classMap[id];
						delete classNameMap[obj.name];
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
			mod.addPropertyDialog = addDialog;
			$('#addObjClassDialog').dialog('open');
		});



		$('.addActorObjBtn').live('click', function (e) {
			curCollection = $(this).attr('data-collection');
			$('#addActorObjDialog').dialog('open');
		});



		$('#addObjClassDialog').dialog({
			autoOpen: false,
			modal: true,
			width: 400,
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


		$('#actorObjDialog').dialog({
			autoOpen: false,
			modal: true,
			position: 'top',
			width: 500,
			title: 'Edit actor objects...',
			buttons: [
				{
					text: "Close",
					click: function () {
						$(this).dialog('close');
					}
				}
			]
		});


		$('#addActorObjDialog').dialog({
			autoOpen: false,
			width: 400,
			modal: true,
			title: 'Add object...',
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
						var className = $('#itemsList option:selected').val();
						var quantity  = parseInt($('#itemsQuantity').val(), 10);

						addObjectToPlayer(curActor.actorId, curCollection, className, null, null, quantity);
					}
				}
			]
		});
	}
}(window));
