function ViewToolSession(app, elm)
{
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
		app.mithril.gm.deleteGm({ id: id }, function (error) {
			if (!error) {
				gm.remove();
				removeGm(id);
			}
		});
	});

	$('.editGmBtn').live('click', function (e) {
		var gm          = $(this).parents('.gmHolder');
		var id          = gm.attr('data-id');
		var params      = {};
		var rights      = [];
		var newPass     = gm.find('.newGmPassword').val();
		var confirmPass = gm.find('.confirmGmPassword').val();

		gm.find('.error').remove();

		if (newPass || confirmPass) {
			if (newPass == confirmPass) {
				params.password = newPass;
			} else {
				gm.find('.confirmGmPassword').after('<div class="error">Passwords don\'t match.</div>');
				e.preventDefault();
				return false;
			}
		}

		gm.find('.gmRight:checked').each(function () {
			rights.push($(this).val());
		});

		params.rights = rights;
		params.actor  = id;
		app.mithril.gm.editGm(params, function (error) {
			if (!error) {
				gmsMap[id].data.rights = params.rights;
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
			app.mithril.player.gm.getPlayerData({ actorId: actorId }, function (error, data) {
				if (error) {
					return alert('Could not retrieve player data.');
				}

				editDlg.find('.field').remove();

				for (var attr in data.data) {
					var itype = 'text';
					var type = typeof data.data[attr];
					var value = (type === 'object') ? JSON.stringify(data.data[attr]) : data.data[attr];
					if (type === 'number') {
						itype = 'number';
					}

					var htmlFrag = '<div class="field">';
					htmlFrag += '<div class="dialogLabel">' + attr + '</div><input type="' + itype + '" data-property="' + attr;
					htmlFrag += '" data-type="' + type  + '" /></div>';
					htmlFrag = $(htmlFrag);

					htmlFrag.find('input').val(value);
					editDlg.prepend(htmlFrag);
				}

				par.append(editDlg);
				editDlg.toggle(300);
			});

		} else {
			par.find('.dialog').toggle(300);
		}
	});


	$('.deletePlayerBtn').live('click', function (e) {
		var player = $(this).parents('.playerHolder');
		var id     = player.attr('data-id');

		app.mithril.player.gm.deletePlayer({ id: id }, function (error) {
			if (error)
				alert('Could not delete Player.');
			else {
				player.remove();
			}
		});
	});

	$('.editPlayerBtn').live('click', function (e) {
		var player = $(this).parents('.playerHolder');
		var id     = player.attr('data-id');
		var dialog = $(this).parents('.dialog');
		var params = getParams('player', dialog);

		app.mithril.player.gm.editPlayer({ id: id, data: params }, function (error) {
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
		var loginUrl = window.mithrilOrigin + '/login?playerId=' + id;
		var session;

		$.get(loginUrl, function (data) {
			session = data;
			window.location = window.mithrilOrigin + '$cfg(tool.gamePath)' + '&playerId=' + id + '&session=' + session;
		});

		e.preventDefault();
		return false;
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

		var params = {
			username: document.getElementById('gmUsername').value,
			password: document.getElementById('gmPassword').value,
			rights: rights
		};

		app.mithril.gm.createGm(params, function (error, id) {
			addToList(ul_gmList, { id: id, username: params.username });
			gmsMap[id] = { actor: id, username: params.username, data: { rights: rights } };
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
		var params = {
			name: username
		};

		app.mithril.io.send('game.createGamePlayer', params, function (error, actor) {
			addToList(ul_playerList, { actor: actor, data: params });
			$(dlg_player).hide(300);
		});
	});

	$(btn_cancelPlayer).click(function () {
		$(dlg_player).hide(300);
	});

	this.onbeforepaint = function (view) {
		// List Gms

		$(ul_gmList).empty();
		$(ul_playerList).empty();
		$('#nav .btn_session').css({ color: 'white', background: 'black', "font-weight": 'bold' });

		app.mithril.gm.getGms(function(error, gms) {
			// populate gm list

			for (var i = 0, len = gms.length; i < len; i++) {
				addToList(ul_gmList, { id: gms[i].actor, username: gms[i].username });
				gmsMap[gms[i].actor] = gms[i];
				gmsArr.push(gmsMap[gms[i].actor]);
			}
		});

		for (var mod in app.mithril) {
			if (typeof(app.mithril[mod]) === 'object') {
				var inputDiv = $('<div class="gmRightDiv"><input type="checkbox" class="gmRight" name="gmRights" value="' + mod + '" /> ' + mod + '</div>');
				$('.gmRightsList').append(inputDiv);
			}
		}

		// List Players

		app.mithril.player.gm.getPlayers(function(error, players) {
			// populate player list
			for (var i = 0, len = players.length; i < len; i++) {
				var id = players[i].actor;
				addToList(ul_playerList, players[i]);
				playersMap[id] = players[i];
				playersArr.push(playersMap[id]);
			}
		});
	};
	
	this.onafterpaint = function (view) {
		
	};
	
	this.onclose = function () {
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
			button = $('<button class="playerDetailBtn" data-id="' + obj.actor + '">Detail</button><button class="playAs" data-id="' + obj.actor + '">Play</button>');
			li.append(button).append((obj.data && obj.data.name) + ' ( ' + obj.actor + ' ) ' + isGm);
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
		var params = {};
		dialog.find('input').each(function () {
			var property = $(this).attr('data-property');
			var type     = $(this).attr('data-type');
			var value    = $(this).val();
			switch (type) {
				case 'number':
					params[property] = parseInt(value);
					break;

				case 'object':
					if (property === 'collectionsComplete' && value === '') {
						value = [];
					} else if (property === 'lastQuestId' && value === '') {
						value = '';
					} else {
						value = JSON.parse(value);
					}

					params[property] = value;
					break;

				case 'string':
				default:
					params[property] = value;
					break;
			}
		});

		return params;
	}
}
