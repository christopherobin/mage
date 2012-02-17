// TODO: Error handling has not been tested (or is broken)

(function (window) {
	var mithril = window.mithril;
	var curGm;
	var gmMap = {};




	mithril.loader.on('gm.display', function () {
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


	//	mithril.loader.displayPage('gm');

		for (var mod in mithril) {
			if (typeof(mithril[mod]) === 'object') {
				var inputDiv = $('<div class="gmRightDiv"><input type="checkbox" class="gmRight" name="gmRights" value="' + mod + '" /> ' + mod + '</div>');
				$('.gmRightsList').append(inputDiv);
			}
		}


		setupHandlers();
	});



	function setupHandlers() {
		$('#addGmBtn').click(function () {
			$('#addGmDialog').dialog('open');
		});


		$('.editGmBtn').live('click', function () {
			curGm = $(this).attr('data-id');
			$('#editGmDialog').dialog('open');
		});


		$('.delGmBtn').live('click', function () {
			if (confirm('Are you sure you want to delete this Gm?')) {
				var gm = $(this).parents('.gmHolder');
				var id = gm.attr('data-id');
				mithril.gm.deleteGm(id, function (error) {
					if (!error) {
						gm.remove();
						delete gmMap[id];
					}
				});
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
				$('#newGmPassword').empty();
				$('#confirmGmPassword').empty();
				$('#editGmDialog .gmRight').attr('checked', false);
				if (gm.data && gm.data.rights) {
					var rights = gm.data.rights;

					for (var i = 0, len = rights.length; i < len; i++) {
						$('#editGmDialog .gmRight[value="' + rights[i] + '"]').attr('checked', true);
					}
				}
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
						editGm();
					} 
				}
			]
		});
	}


	function addGm() {
		var eleRights = $('#addGmDialog .gmRight');
		var rights    = [];

		for (var i = 0, len = eleRights.length; i < len; i++) {
			if (eleRights[i].checked) {
				rights.push(eleRights[i].value);
			}
		}

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
		var rights      = [];
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

		gm.find('.gmRight:checked').each(function () {
			rights.push($(this).val());
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
		var delBtn = '<button class="delGmBtn" data-id="' + obj.id + '">X</button>';
		li.append(button).append(obj.username + ' ( ' + obj.id + ' )' + delBtn);

		$('#gmList').append(li);
	}


}(window));
