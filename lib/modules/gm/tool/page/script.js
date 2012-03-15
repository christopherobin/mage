// TODO: Error handling has not been tested (or is broken)

(function (window) {
	var mithril = window.mithril;
	var curGm;
	var gmMap = {};
	var setup = false;


	function addGmToList(obj) {
		var li     = $('<li class="gmHolder" data-id="' + obj.id + '"></li>');
		var button = '<button class="editGmBtn" data-id="' + obj.id + '">Edit</button>';
		li.append(button).append(obj.username + ' ( ' + obj.id + ' )');

		$('#gmList').append(li);
	}


	function addGm() {
		$('#addGmDialog .error').remove();

		var username = document.getElementById('gmUsername').value;
		var password = document.getElementById('gmPassword').value;


		if (!username) {
			$('#gmUsername').after('<div class="error">Username cannot be blank.</div>');
			return;
		}

		if (!password) {
			$('#gmPassword').after('<div class="error">Password cannot be blank.</div>');
			return;
		}


		if (password.length < 6) {
			$('#gmPassword').after('<div class="error">Password must be at least 6 characters.</div>');
			return;
		}


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


		mithril.gm.createGm(username, password, rights, function (error, id) {
			if (error) {

				switch (error) {
				case 'missingUserName':
					return $('#gmUsername').after('<div class="error">Username cannot be blank.</div>');

				case 'missingPassword':
					return $('#gmPassword').after('<div class="error">Password cannot be blank.</div>');

				case 'passwordTooShort':
					return $('#gmPassword').after('<div class="error">Password must be at least 6 characters.</div>');

				default:
					return console.error('Could not create Gm : ', error);
				}
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
				gm.find('#confirmGmPassword').after('<div class="error">Passwords don\'t match.</div>');
				return false;
			}

			if (newPass.length < 6) {
				$('#confirmGmPassword').after('<div class="error">Password must be at least 6 characters.</div>');
				return;
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
				setTimeout(function () {
					updated.toggle(300);
					updated.remove();
				}, 4500);

				$('#editGmDialog').dialog('close');
			} else {
				console.error(error);
			}
		});
	}


	function setupHandlers() {
		$('#addGmBtn').click(function () {
			$('#addGmDialog').dialog('open');
		});


		$('.editGmBtn').live('click', function () {
			curGm = $(this).attr('data-id');
			$('#editGmDialog').dialog('open');
		});


		$('.modViewable').live('click', function () {
			var mod = $(this).parents('.gmRightDiv').find('.gmRight');
			if ($(this).is(':checked'))	{
				mod.attr('checked', true);
			} else {
				mod.attr('checked', false);
			}
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
				$('#newGmPassword').val('');
				$('#confirmGmPassword').val('');
				$('#editGmDialog .gmRight').attr('checked', false);

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
					text: 'Save',
					click: function () {
						editGm();
					}
				}
			]
		});
	}


	mithril.loader.on('gm.display', function () {
		if (!setup) {
			setup = true;

			$('#gmList').empty();


			mithril.gm.getGms(function (error, gms) {		// List Gms
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

}(window));
