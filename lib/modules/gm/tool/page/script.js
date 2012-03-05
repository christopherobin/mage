// TODO: Error handling has not been tested (or is broken)

(function (window) {
	var mithril = window.mithril;
	var curGm;
	var gmMap = {};
	var setup = false;




	mithril.loader.on('gm.display', function () {
		if (!setup) {
			setup = true;

			$('#gmList').empty();


			mithril.gm.getGms(function(error, gms) {		// List Gms
				if (error) {
					return console.warn('Could not retrieve gms');
				}

				for (var i = 0, len = gms.length; i < len; i++) {
					var gm = gms[i];
					addGmToList({ id: gm.actor, username: gm.username });
					gmMap[gm.actor] = gm;
				}

			});


			var availableMods = window.tool.availableMods;


			for (var j = 0, jlen = availableMods.length; j < jlen; j++) {
				var mod = availableMods[j];

				var inputDiv = '<div class="gmRightDiv" data-mod="' + mod + '"><div class="modNameTag">';
				inputDiv    += '<input type="checkbox" class="gmRight" name="gmRights" value="' + mod + '" /> ';
				inputDiv    += mod + '</div>';
				inputDiv    += '<span class="viewableTag"><input type="checkbox" class="modViewable" value="true" />viewable</span></div>';
				$('.gmRightsList').append(inputDiv);
			}


			setupHandlers();
		}
	});



	function setupHandlers() {
		$('#addGmBtn').click(function () {
			$('#addGmDialog').dialog('open');
		});


		$('.editGmBtn').live('click', function () {
			curGm = $(this).attr('data-id');
			$('#editGmDialog').dialog('open');
		});


		$('#addGmDialog').dialog({
			autoOpen: false,
			width: 550,
			modal: true,
			title: 'Add Gm...',
			open: function () {
				// TODO: reset values
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
						addGm();
					}
				}
			]
		});


		$('#editGmDialog').dialog({
			autoOpen: false,
			width: 550,
			modal: true,
			title: 'Edit Gm...',
			open: function () {
				var gm = gmMap[curGm];
				$('#newGmPassword').empty();
				$('#confirmGmPassword').empty();
				$('#editGmDialog .gmRight').attr('checked', false);
				$('div.dialog < .ui-dialog-buttonpane button:first').css({ float: 'left'});

				if (gm.data && gm.data.rights) {
					var rights = gm.data.rights;

					for (var mod in rights) {
						$('#editGmDialog .gmRight[value="' + mod + '"]').attr('checked', true);

						if (rights[mod].viewable) {
							$('#editGmDialog .gmRightDiv[data-mod="' + mod + '"] .modViewable').attr('checked', true);
						}
					}

					for (var i = 0, len = rights.length; i < len; i++) {
						$('#editGmDialog .gmRight[value="' + rights[i] + '"]').attr('checked', true);
					}
				}
			},
			buttons: [
				{
					text: 'Delete GM',
					click: function () {
						if (confirm('Are you sure you want to delete this Gm?')) {
							mithril.gm.deleteGm(curGm, function (error) {
								if (!error) {
									$('#gmList .gmHolder[data-id="' + curGm + '"]').remove();
									delete gmMap[curGm];
									$('#editGmDialog').dialog('close');
								}
							});
						}
					}
				},
				{
					text: 'Cancel',
					click: function () {
						$(this).dialog('close');
					}
				},
				{
					text: 'Edit',
					click: function () {
						editGm();
					}
				}
			]
		});
	}


	function addGm() {
		var rights = {};
		$('#addGmDialog .gmRightDiv').each(function () {
			var gmRight = $(this);
			var mod     = gmRight.attr('data-mod');

			if (gmRight.find('.gmRight:checked').length !== 0) {
				rights[mod] = { viewable: false };

				if (gmRight.find('.modViewable:checked').length !== 0) {
					rights[mod].viewable = true;
				}
			}
		});


		var username = document.getElementById('gmUsername').value;
		var password = document.getElementById('gmPassword').value;

		mithril.gm.createGm(username, password, rights, function (error, id) {
			if (error) {
				// TODO: display some kinda error
				return console.error('Could not create Gm : ', error);
			}

			addGmToList({ id: id, username: username });
			gmMap[id] = {
				actor: id,
				username: username,
				data: {
					rights: rights
				}
			};

			$('#addGmDialog').dialog('close');
		});
	}


	function editGm() {
		var rights      = {};
		var newPass     = $('#newGmPassword').val();
		var confirmPass = $('#confirmGmPassword').val();
		var gm = $('#editGmDialog');

		gm.find('.error').remove();

		if (newPass || confirmPass) {
			if (newPass !== confirmPass) {
				gm.find('.confirmGmPassword').after('<div class="error">Passwords don\'t match.</div>');
				return false;
			}
		} else {
			newPass = null;
		}


		gm.find('.gmRightDiv').each(function () {
			var gmRight = $(this);
			var mod     = gmRight.attr('data-mod');

			if (gmRight.find('.gmRight:checked').length !== 0) {
				rights[mod] = { viewable: false };

				if (gmRight.find('.modViewable:checked').length !== 0) {
					rights[mod].viewable = true;
				}
			}
		});

		gmMap[curGm].data.rights = rights;

		mithril.gm.editGm(curGm, newPass, rights, function (error) {
			if (!error) {
				var updated = $('<div class="updated" style="display: none;">Saved!</div>');
				gm.find('.dialog').append(updated);
				updated.toggle(300);
				setTimeout(function() {
					updated.toggle(300);
					updated.remove();
				}, 4500);

				$('#editGmDialog').dialog('close');
			}
		});
	}


	function addGmToList(obj) {
		var li     = $('<li class="gmHolder" data-id="' + obj.id + '"></li>');
		var button = '<button class="editGmBtn" data-id="' + obj.id + '">Edit</button>';
		li.append(button).append(obj.username + ' ( ' + obj.id + ' )');

		$('#gmList').append(li);
	}


}(window));
