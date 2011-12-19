(function () {

	var mithril = window.mithril;
	var viewport = window.viewport;
	var curEditDlg;
	
	var view = {};
	
	var elm = viewport.getViewElement("tool_session");
	
	viewport.setViewHandler({
		name: "tool_session",
		obj: view,
		elm: elm
	});
	
	var origin = 'http://$cfg(server.clientHost.expose.host):$cfg(server.clientHost.expose.port)';

	var gmsMap      = {};
	var gmsArr      = [];
	var playersMap  = {};
	var playersArr  = [];

	var btn_addGm           = document.getElementById('addGmBtn');
	var btn_confirmGm       = document.getElementById('confirmAddGm');
	var btn_cancelGm        = document.getElementById('cancelAddGm');

	var btn_addPlayer       = document.getElementById('addPlayerBtn');
	var btn_confirmPlayer   = document.getElementById('confirmAddPlayer');
	var btn_cancelPlayer    = document.getElementById('cancelAddPlayer');

	var ul_gmList           = document.getElementById('gmList');
	var ul_playerList       = document.getElementById('playerList');
	var dlg_gm              = document.getElementById('gmDialog');
	var dlg_player          = document.getElementById('playerDialog');

	var jq_rightsList      = $('.gmRightsList');


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
				gmsMap[id].data.rights = rights;
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
			var gm = gmsMap[actorId];
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


	$('.playerDetailBtn').live('click', function () {
		var par     = $(this).parents('li');
		var actorId = par.attr('data-id');
		if (par.find('.dialog').length == 0) {
			var player = playersMap[actorId];
			var editDlg = $('#editPlayerDialog').clone();
			editDlg.removeAttr('id');
			editDlg[0].style.display = 'none';

			// Load player data
			mithril.actor.getActorData(actorId, function (error, data) {
				if (error) {
					return console.warn('Could not retrieve player data.');
				}

				var input = '';

				for (var attr in data) {
					var type = typeof data[attr];
					
					input += generatePropField(attr, type, data[attr]);
				}

				editDlg.prepend(input);
				par.append(editDlg);
				editDlg.toggle(300);
			});

		} else {
			par.find('.dialog').toggle(300);
		}

		var scrollheight = par.position().top + 60;
		window.setTimeout(function () { scroll(0, scrollheight); }, 310);
	});


	function generatePropField(attr, type, data) {
		var input = '';
		var prop = '<div class="propName">' + attr + '<button class="removeProperty">X</button></div>';

		input += '<div class="dataField">';

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



	$('.deletePlayerBtn').live('click', function (e) {
/*		// ignoring this for now, since have no clue what behavior it should have
		var player = $(this).parents('.playerHolder');
		var id     = player.attr('data-id');

		mithril.player.deletePlayer({ id: id }, function (error) {
			if (error)
				alert('Could not delete Player.');
			else {
				player.remove();
			}
		});
*/
	});

	$('.editPlayerBtn').live('click', function (e) {
		var player = $(this).parents('.playerHolder');
		var id     = player.attr('data-id');
		var dialog = $(this).parents('.dialog');
		var data   = getParams('player', dialog);

		mithril.actor.editActor(id, data, function (error) {
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


	$('.addProperty').live('click', function (e) {
		var editDlg     = $(this).parents('.dialog');
		curEditDlg      = editDlg;
		var propertyDlg = $('#addPropertyDlg').clone().show();
		$('.viewToolSession').append(propertyDlg);
		$(this).attr('disabled', true);
	});


	$('.removeProperty').live('click', function (e) {
		$(this).parents('.dataField').remove();
	});


	$('#addPropertyDlg select').live('change', function (e) {
		var dlg = $(this).parents('#addPropertyDlg');
		var type = $(this).find('option:selected').val();
		dlg.find('.value').hide();
		dlg.find('.value[data-type="' + type + '"]').show();
	});

	$('.cancelAddProperty').live('click', function (e) {
		$(this).parents('#addPropertyDlg').remove();
		curEditDlg.find('.addProperty').removeAttr('disabled');
	});


	$('.confirmAddProperty').live('click', function (e) {
		var dlg = $(this).parents('#addPropertyDlg');
		var property = dlg.find('input[data-id="property"]').val();
		var type = dlg.find('select[data-id="type"] option:selected').val();
		var value = dlg.find('.value[data-type="' + type + '"] input, .value[data-type="' + type + '"] textarea').val();
		if (type === 'boolean') {
			value = (value === 'true');
		}

		var ele = generatePropField(property, type, value);
		curEditDlg.find('.dataField').filter(':last').after(ele);
		curEditDlg.find('.addProperty').removeAttr('disabled');
		dlg.remove();
	});

	$(btn_addGm).click(function () {
		document.getElementById('gmUsername').value = '';
		document.getElementById('gmPassword').value = '';
		var eleRights = elm.querySelectorAll('.gmRight');

		for (var i = 0, len = eleRights.length; i < len; i++) {
			eleRights[i].checked = false;
		}

		$(dlg_gm).show(300);
	});

	$(btn_confirmGm).click(function () {
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
			addToList(ul_gmList, { id: id, username: username });
			gmsMap[id] = { actor: id, username: username, data: { rights: rights } };
			gmsArr.push(gmsMap[id]);
			$(dlg_gm).hide(300);
		});
	});

	$(btn_cancelGm).click(function () {
		$(dlg_gm).hide(300);
	});

	$(btn_addPlayer).click(function () {
		$('#playerUsername').val('');
		$(dlg_player).show(300);
	});

	$(btn_confirmPlayer).click(function () {
		var username = $('#playerUsername').val();

		mithril.gm.createNewPlayer(username, function (error, actor) {
			if (error) {
				console.warn('Could not create new player.');
			} else {
				if (actor != undefined && actor != null) {
					addToList(ul_playerList, { actor: actor, data: { name: username } });
				} else {
					console.warn('actorId not returned, please make sure the actorId is returned on player creation.');
				}
			}
			$(dlg_player).hide(300);
		});
	});

	$(btn_cancelPlayer).click(function () {
		$(dlg_player).hide(300);
	});

	view.onbeforepaint = function () {
		// List Gms

		$(ul_gmList).empty();
		$(ul_playerList).empty();
		$('#nav .btn_session').css({ color: 'white', background: 'black', "font-weight": 'bold' });


		window.mithril.gm.getGms(function(error, gms) {		// List Gms

			for (var i = 0, len = gms.length; i < len; i++) {
				addToList(ul_gmList, { id: gms[i].actor, username: gms[i].username });
				gmsMap[gms[i].actor] = gms[i];
				gmsArr.push(gmsMap[gms[i].actor]);
			}

			// TODO -- add async later
			mithril.player.getPlayers(function(error, players) {		// List Players
				// populate player list
				for (var i = 0, len = players.length; i < len; i++) {
					var id = players[i].actor;
					addToList(ul_playerList, players[i]);
					playersMap[id] = players[i];
					playersArr.push(playersMap[id]);
				}
			});
		});


		for (var mod in mithril) {
			if (typeof(mithril[mod]) === 'object') {
				var inputDiv = $('<div class="gmRightDiv"><input type="checkbox" class="gmRight" name="gmRights" value="' + mod + '" /> ' + mod + '</div>');
				$('.gmRightsList').append(inputDiv);
			}
		}
	};

	view.onclose = function () {
		$('#nav .btn_session').css({ color: 'white', background: 'gray', "font-weight": 'normal' });
	};

	function addToList(list, obj) {
		var li, button;
		if (list.id == 'gmList') {
			li     = $('<li class="gmHolder" data-id="' + obj.id + '"></li>');
			button = $('<button class="gmDetailBtn" data-id="' + obj.id + '">Detail</button>');
			li.append(button).append(obj.username + ' ( ' + obj.id + ' )');

		} else {
			var isGm = (gmsMap[obj.actor]) ? ' *' : '';
			li     = $('<li class="playerHolder" data-id="' + obj.actor + '"></li>');
			button = $('<button class="playerDetailBtn" data-id="' + obj.actor + '">Detail</button>');
			li.append(button).append((obj.data && obj.data.name) + ' ( ' + obj.actor + ' ) ' + isGm + '<button class="playAs" data-id="' + obj.actor + '">Play</button>');
		}

		$(list).append(li);
	}

	function getValue(value) {
		if (value === undefined || value === null) {
			return '';
		}

		return value.toString();
	}

	function removeGm(id) {
		delete gmsMap[id];
		for (var i = 0, len = gmsArr.length; i < len; i++) {
			if (gmsArr[i].actor == id) {
				gmsArr.splice(i, 1);
			}
		}
	}

	function removePlayer(id) {
		delete playersMap[id];
		for (var i = 0, len = playersArr.length; i < len; i++) {
			if (playersArr[i].actor == id) {
				playersArr.splice(i, 1);
			}
		}
	}

	function getParams(type, dialog) {
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
					params.push({ property: property, value: (value == 'true') });
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
}());
