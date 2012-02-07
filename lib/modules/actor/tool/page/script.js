$html5client(module.actor);
$html5client(module.player);


if (!window.tool) {
	window.tool = {};
}

var actor = {};
window.tool.actor = actor;
var origin = 'http://$cfg(server.clientHost.expose.host):$cfg(server.clientHost.expose.port)';


// TODO: Remove all gm related management stuff and move to gm module

mithril.loader.on('actor.loaded', function () {
//	actor.gmsMap   = {};
//	actor.gmsArr   = [];

	actor.itemsMap = {};
	actor.curPlayer;


	mithril.setup(function (error) {
		if (error) {
			return console.error(error);
		}


//		$('#gmList').empty();
		$('#playerList').empty();
		$('#nav .btn_session').css({ color: 'white', background: 'black', "font-weight": 'bold' });


		// TODO: This is a hack until I can have the obj module provide this info for me
		var objClasses = [];
		if (mithril.obj) {
			objClass = mithril.obj.getClassesByName();
		} else {
			$('#itemsTab').hide();
		}

		var objHtml    = '';

		for (var i = 0, len = objClasses.length; i < len; i++) {
			var objClass = objClasses[i];
			objHtml += '<option value="' + objClass.name + '">' + ((objClass.data && objClass.data.name) ? objClass.data.name : objClass.name) + '</option>';
			actor.itemsMap[objClass.name] = objClass;
		}

		$('#addPlayerItemDialog select').append(objHtml);

/*
		window.mithril.gm.getGms(function(error, gms) {		// List Gms
			if (error) {
				return console.warn('Could not retrieve gms');
			}

			for (var i = 0, len = gms.length; i < len; i++) {
				addGmToList({ id: gms[i].actor, username: gms[i].username });
				actor.gmsMap[gms[i].actor] = gms[i];
				actor.gmsArr.push(actor.gmsMap[gms[i].actor]);
			}
		});
*/

		for (var mod in mithril) {
			if (typeof(mithril[mod]) === 'object') {
				var inputDiv = $('<div class="gmRightDiv"><input type="checkbox" class="gmRight" name="gmRights" value="' + mod + '" /> ' + mod + '</div>');
				$('.gmRightsList').append(inputDiv);
			}
		}

		setupHandlers();
	});

	mithril.loader.displayPage('actor');
});


function setupHandlers() {
/*
	$('.deleteGmBtn').live('click', function () {
		var gm = $(this).parents('.gmHolder');
		var id = gm.attr('data-id');
		mithril.gm.deleteGm(id, function (error) {
			if (!error) {
				gm.remove();
				removeGm(id);
			}
		});
	});

	$('.editGmBtn').live('click', function (e) {
		var gm          = $(this).parents('.gmHolder');
		var id          = gm.attr('data-id');
		var rights      = [];
		var newPass     = gm.find('.newGmPassword').val();
		var confirmPass = gm.find('.confirmGmPassword').val();

		gm.find('.error').remove();

		if (newPass || confirmPass) {
			if (newPass !== confirmPass) {
				gm.find('.confirmGmPassword').after('<div class="error">Passwords don\'t match.</div>');
				e.preventDefault();
				return false;
			}
		} else {
			newPass = null;
		}

		gm.find('.gmRight:checked').each(function () {
			rights.push($(this).val());
		});

		mithril.gm.editGm(id, newPass, rights, function (error) {
			if (!error) {
				actor.gmsMap[id].data.rights = rights;
				var updated = $('<div class="updated" style="display: none;">Saved!</div>');
				gm.find('.dialog').append(updated);
				updated.toggle(300);
				setTimeout(function() {
					updated.toggle(300);
					updated.remove();
				}, 4500);
			}
		});
	});


	$('.gmDetailBtn').live('click', function () {
		var par     = $(this).parents('li');
		var actorId = par.attr('data-id');
		if (par.find('.dialog').length == 0) {
			var gm = actor.gmsMap[actorId];
			var editDlg = $('#editGmDialog').clone();
			par.append(editDlg);
			if (gm && gm.data && gm.data.rights) {
				rights = gm.data.rights;
				for (var i = 0, len = rights.length; i < len; i++) {
					editDlg.find('.gmRight[value="' + rights[i] + '"]').attr('checked', true);
				}
			}
			editDlg.toggle(300);
		} else {
			par.find('.dialog').toggle(300);
		}

		scroll(0, par.position().top);
	});
*/

	$('.openPlayerDialog').live('click', function () {
		var actorId = $(this).attr('data-id');

		mithril.actor.getActorData(actorId, function (error, data) {
			if (error) {
				actor.curPlayer = null;
				return console.warn('Could not retrieve player data.');
			}

			actor.curPlayer = {};
			actor.curPlayer.actorId = actorId;
			actor.curPlayer.data = data;

			// TODO: HACK!! fix once obj module can extend the actor module
			if (mithril.obj) {
				mithril.obj.getFullCollectionsByPlayer(actorId, function (error, items) {
					if (error) {
						return console.warn('Could not retrieve item data');
					}

					actor.curPlayer.items = items;
					loadPlayerDialog();
				});
			} else {
				loadPlayerDialog();
			}
		});

	});


	$('#savePlayerDataBtn').live('click', function (e) {
		var dialog = $('#playerDataValues');
		var data   = getParams(dialog);

		mithril.actor.editActor(actor.curPlayer.actorId, data, function (error) {
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
	});


	$('.playAs').live('click', function (e) {
		var id       = $(this).attr('data-id');
		var loginUrl = origin + '/login?playerId=' + id;
		var session;

		$.get(loginUrl, function (data) {
			session = data;
			window.location = origin + '/app/game?language=EN#pages=landing,main&playerId=' + id + '&session=' + session;
		});

		e.preventDefault();
		return false;
	});


	$('#addProperty').live('click', function (e) {
		$('#addPropertyDialog').dialog('open');
	});


	$('.addPlayerItemBtn').live('click', function (e) {
		curCollection = $(this).attr('data-collection');
		$('#addPlayerItemDialog').dialog('open');
	});


	$('.removeProperty').live('click', function (e) {
		$(this).parents('.dataField').remove();
	});


	$('.removePlayerItem').live('click', function (e) {
		var objId = $(this).attr('data-id');
		var obj   = $(this).parents('.collectionObject');

		window.mithril.obj.delObject(objId, function (error) {
			if (error) {
				return console.warn('Could not delete object ' + objId + ' from player ' + actor.curPlayer.actorId);
			}

			obj.remove();
		});
	});


	$('#addPropertyDialog select').live('change', function (e) {
		var dlg = $(this).parents('#addPropertyDialog');
		var type = $(this).find('option:selected').val();
		dlg.find('.value').hide();
		dlg.find('.value[data-type="' + type + '"]').show();
	});


	$('#searchValue').keypress(function (e) {
		if (e.keyCode === 13) {
			$('#searchBtn').click();
			e.preventDefault();
		}
	});


	$('#searchBtn').click(function (e) {
		var search = {};
		var limit = 30;
		var page;

		var searchType = $('#playerListHolder input:radio:checked').val();
		if (searchType === 'actor') {
			search.id = parseInt($('#searchValue').val(), 10);
		} else {
			search.properties = {};
			search.properites[searchType] = $('#searchValue').val();
		}

		mithril.player.getPlayers(search, limit, page, function(error, players) {
			// populate player list
			$('#playerList').empty();
			if (players.length === 0) {
				$('#playerList').append('No players found');
			}

			for (var i = 0, len = players.length; i < len; i++) {
				var id = players[i].actor;
				addPlayerToList(players[i]);
			}
		});

	});

/*
	$('#addGmButton').click(function () {
		document.getElementById('gmUsername').value = '';
		document.getElementById('gmPassword').value = '';
		var eleRights = elm.querySelectorAll('.gmRight');

		for (var i = 0, len = eleRights.length; i < len; i++) {
			eleRights[i].checked = false;
		}

		$('#gmDialog').show(300);
	});

	$('#confirmAddGm').click(function () {
		var eleRights = elm.querySelectorAll('#gmDialog .gmRight');
		var rights    = [];

		for (var i = 0, len = eleRights.length; i < len; i++) {
			if (eleRights[i].checked) {
				rights.push(eleRights[i].value);
			}
		}

		var username = document.getElementById('gmUsername').value;
		var password = document.getElementById('gmPassword').value;

		mithril.gm.createGm(username, password, rights, function (error, id) {
			addGmToList({ id: id, username: username });

			actor.gmsMap[id] = { actor: id, username: username, data: { rights: rights } };
			actor.gmsArr.push(actor.gmsMap[id]);
			$('#gmDialog').hide(300);
		});
	});

	$('#cancelAddGm').click(function () {
		$('#gmDialog').hide(300);
	});
*/



	$('#addPlayerBtn').click(function () {
		$('#playerUsername').val('');
		$('#playerDialog').show(300);
	});

	$('#confirmAddPlayer').click(function () {
		var username = $('#playerUsername').val();

		mithril.gm.createNewPlayer(username, function (error, actor) {
			if (error) {
				console.warn('Could not create new player.');
			} else {
				if (actor != undefined && actor != null) {
					addPlayerToList({ actor: actor, data: { name: username } });
				} else {
					console.warn('actorId not returned, please make sure the actorId is returned on player creation.');
				}
			}
			$('#playerDialog').hide(300);
		});
	});


	$('.tabs').live('click', function (e) {
		var tabName = $(this).attr('data-id');
		$('.tabs').removeClass('activeTab');

		$('.tabs[data-id="' + tabName + '"]').addClass('activeTab');
		$('.playerDetails').hide();
		$('.playerDetails[data-id="' + tabName + '"]').show();
	});

	$('#cancelAddPlayer').click(function () {
		$('#playerDialog').hide(300);
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


	$('#addPlayerItemDialog').dialog({
		autoOpen: false,
		width: 'auto',
		modal: true,
		title: 'Add item...',
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

					addItem(actor.curPlayer.actorId, curCollection, className, null, null, quantity);
				}
			}
		]
	});


	$('#editPlayerDialog').dialog({
		autoOpen: false,
		width: 1180,
		title: 'Edit player',
		buttons: [
			{
				text: 'Close',
				click: function () {
					$(this).dialog('close');
				}
			}
		]
	});


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


function generateCollectionsHtml(items) {
	var html = '';
	var collections = items && items.collections || {};

	for (var col in collections) {
		var collection = collections[col];
		// if the owner is the player, display
		if (~~collection.owner === ~~actor.curPlayer.actorId) {
			html += '<div class="playerCollection"><div class="collectionType">' + collection.type + '</div>'
			html += '<div class="playerObjects" data-id="' + collection.id + '">' + generateObjectsHtml(collection.members, items.objectsMap) + '</div>';
			html += '<br /><button class="addPlayerItemBtn" data-collection="' + collection.id + '">Add Item</button></div>';
		}
	}

	return html;
}

function generateObjectsHtml(members, objMap) {
	var html = '';

	for (var i = 0, len = members.length; i < len; i++) {
		var objId    = members[i].id;
		var obj      = objMap[objId];
		var objClass = actor.itemsMap[obj.name];

		if (!obj) {
			return console.warn('Member object not found in objects list : ', members[i]);
		}

		if (!objClass) {
			return console.warn('Object not found in object definitions : ', obj.name, ' Object has possibly been removed, but player still owns a copy of the object');
		}

		html += '<div class="collectionObject" data-id="' + objId + '">';
		html += ((objClass && objClass.data && objClass.data.name) ? objClass.data.name : obj.name);
		html += '<button class="removePlayerItem removeBtn" data-id="' + objId + '">X</button>';
		html += '</div>';
	}

	return html;
}




function loadPlayerDialog() {
	$('#playerDataValues').empty();
	$('#playerItemCollections').empty();

	if (!actor.curPlayer) {
		return console.warn('player data not found for player : ', actor.curPlayer);
	}

	var data  = actor.curPlayer.data;
	var items = actor.curPlayer.items;


	var dataFields = '';

	for (var attr in data) {
		var type = typeof data[attr];
		
		dataFields += generatePropField(attr, type, data[attr]);
	}

	$('#playerDataValues').empty();
	$('#playerDataValues').append(dataFields);


	// TODO: START HACK

	// create a map of objects for quick lookup
	var objMap = {};
	var objs = items && items.objects || [];
	for (var i = 0, len = objs.length; i < len; i++) {
		objMap[objs[i].id] = objs[i];
	}

	if (items) {
		items.objectsMap = objMap;
	}

	// ENDHACK

	var itemFields = generateCollectionsHtml(items);
	$('#playerItemCollections').empty();
	$('#playerItemCollections').append(itemFields);

	$('#editPlayerDialog').dialog('open');
}


function addProperty() {
	var dlg = $('#addPropertyDialog');
	var property = dlg.find('input[data-id="property"]').val();

	if ($('#playerDataValues .dataField[data-id="' + property + '"]').length !== 0) {
		return alert('Property ' + property + ' already exists');
	}

	var type = dlg.find('select[data-id="type"] option:selected').val();
	var value = dlg.find('.value[data-type="' + type + '"] input, .value[data-type="' + type + '"] textarea').val();
	if (type === 'boolean') {
		value = dlg.find('.value[data-type="boolean"] input:checked').length > 0;
	}

	var ele = generatePropField(property, type, value);
	$('#playerDataValues').append(ele);
	dlg.dialog('close');
}


function addItem(actorId, collectionId, name, weight, tags, quantity) {
	mithril.obj.addObjectToPlayer(actorId, collectionId, name, weight, tags, quantity, function (error, objIds) {
		if (error) {
			return console.warn('Could not add item ' + name + ' to player ' + actorId);
		}

		var objMap  = actor.curPlayer.items.objectsMap;
		var members = [];

		for (var i = 0, len = objIds.length; i < len; i++) {
			var id = objIds[i];
			members.push({ id: id });
			objMap[id] = { id: id, name: name };
		}

		var html = generateObjectsHtml(members, objMap);
		$('.playerObjects[data-id="' + curCollection + '"]').append(html);
		$('#addPlayerItemDialog').dialog('close');
	});
}

/*
function addGmToList(obj) {
	var li     = $('<li class="gmHolder" data-id="' + obj.id + '"></li>');
	var button = $('<button class="gmDetailBtn" data-id="' + obj.id + '">Detail</button>');
	li.append(button).append(obj.username + ' ( ' + obj.id + ' )');

	$('#gmList').append(li);
}
*/

function addPlayerToList(obj) {
//	var isGm   = (actor.gmsMap[obj.actor]) ? ' *' : '';
	var li     = $('<li class="playerHolder" data-id="' + obj.actor + '"></li>');
	var button = $('<button class="openPlayerDialog" data-id="' + obj.actor + '">Edit</button>');
	
//	li.append(button).append('<button class="playAs" data-id="' + obj.actor + '">Play</button>' + (obj.data && obj.data.name) + ' ( ' + obj.actor + ' ) ' + isGm);
	li.append(button).append('<button class="playAs" data-id="' + obj.actor + '">Play</button>' + (obj.data && obj.data.name) + ' ( ' + obj.actor + ' ) ');

	$('#playerList').append(li);
}

/*
function removeGm(id) {
	delete actor.gmsMap[id];
	for (var i = 0, len = actor.gmsArr.length; i < len; i++) {
		if (actor.gmsArr[i].actor == id) {
			actor.gmsArr.splice(i, 1);
		}
	}
}
*/

function getParams(dialog) {
	var params = [];
	dialog.find('input, textarea').each(function () {
		var property = $(this).attr('data-property');
		var type     = $(this).attr('data-type');
		var value    = $(this).val();
		switch (type) {
			case 'number':
				params.push({ property: property, value: parseInt(value) });
				break;

			case 'object':
				params.push({ property: property, value: JSON.parse(value) });
				break;

			case 'bool':
				params.push({ property: property, value: $(this).is(':checked') });
				break;

			case 'string':
			default:
				var param = { property: property, value: value };
				var lang = $(this).attr('data-language');
				if (lang !== '') {
					param.language = lang;
				}

				params.push(param);
				break;
		}
	});

	return params;
}

