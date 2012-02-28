$html5client('module.actor');
$html5client('module.player');

(function (window) {
	var actor = {};
	window.tool.actor = actor;
	var mithril = window.mithril;

	var itemsMap = {};
	var curPlayer = 0;

	var pageLimit = 50;
	var setup = false;


	function getActorId(query, cb) {
		cb(null, [parseInt(query, 10)]);
	}

	var extensions = [
		{
			type: 'selector',
			target: 'actor',
			name: 'actor',
			extendFn: getActorId
		}
	];


	mithril.gm.extend(extensions, function (error) {
		if (error) {
			console.warn('Module actor failed to extend.');
		}
	});


	mithril.loader.on('actor.display', function () {
		if (!setup) {
			setup = true;

			mithril.setupModules(['actor', 'player', 'obj'], function (error) {
				if (error) {
					return console.error(error);
				}

				$('#playerList').empty();




				setupReplacements();
				setupHandlers();
			});
		}
	});


	function setupReplacements() {
		// Setup replacements here

		var extensions = mithril.gm.extensions;
		var selectors = extensions && extensions.selector && extensions.selector.actor || {};
		for (var mod in selectors) {
			$('#searchType').append('<option value="' + mod + '">' + mod + '</option>');
		}

		var dataManagers = extensions && extensions.dataManager && extensions.dataManager.actorData;
		for (var manager in dataManagers) {
			var tab = '<div class="tabs actorData" data-id="' + manager + '">Items</div>';
			$('#gachaTabs').append(tab);
		}
	}


	function setupHandlers() {
		actor.addPropertyDialog = $('#editPlayerDialog');

		$('.openPlayerDialog').live('click', function () {
			var actorId = $(this).attr('data-id');

			mithril.actor.getActorData(actorId, function (error, data) {
				if (error) {
					curPlayer = null;
					return console.warn('Could not retrieve player data.');
				}

				curPlayer = {};
				curPlayer.actorId = actorId;
				curPlayer.data = data;

				loadPlayerDialog();
			});

		});


		$('.playAs').live('click', function (e) {
				var id = $(this).attr('data-id');
				mithril.gm.play(id, function (error, response) {
						if (error) {
								console.warn('Cannot login : ', error);
						}

						if (response.url) {
								window.location = response.url;
						} else {
								console.warn('No url provided in the login response');
						}
				});

				e.preventDefault();
				return false;
		});


		$('#addProperty').live('click', function (e) {
			$('#addPropertyDialog').dialog('open');
		});


		$('.removePlayerItem').live('click', function (e) {
			var objId = $(this).attr('data-id');
			var obj   = $(this).parents('.collectionObject');

			window.mithril.obj.delObject(objId, function (error) {
				if (error) {
					return console.warn('Could not delete object ' + objId + ' from player ' + curPlayer.actorId);
				}

				obj.remove();
			});
		});


		$('#searchValue').keypress(function (e) {
			if (e.keyCode === 13) {
				$('#actor_searchBtn').click();
				e.preventDefault();
			}
		});


		$('#actor_searchBtn').click(function (e) {
			var extensions = mithril.gm.extensions;
			var searchType = $('#searchType option:selected').val();
			var query      = $('#searchValue').val();
			var searchFn   = extensions && extensions.selector && extensions.selector.actor && extensions.selector.actor[searchType];

			if (searchFn) {

				searchFn(query, function (error, ids) {
					if (error) {
						return console.error(error);
					}

					if (ids) {
						mithril.player.getPlayers(ids, null, null, null, function (error, players) {
							if (error) {
								return console.error(error);
							}

							$('#playerList').empty();
							addPlayersToList(players);
						});
					} else {
						addPlayersToList([]);
					}
				});
			}
		});


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
					if (actor !== undefined && actor !== null) {
						addPlayersToList([{ actor: actor, data: { name: username } }]);
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

			mithril.loader.renderPage(tabName);
			var manageFn = mithril.gm.extensions && mithril.gm.extensions.dataManager.actorData[tabName];
			manageFn(curPlayer.actorId);
		});

		$('#cancelAddPlayer').click(function () {
			$('#playerDialog').hide(300);
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
				},
				{
					text: 'Edit',
					click: function () {
						editPlayer();
					}
				}
			]
		});


		$('#getAllPlayers').click(function (e) {
			var limit = pageLimit + 1;
			mithril.player.getPlayers(null, null, limit, null, function (error, players) {
				if (error) {
					return console.error('Could not retrieve players. ', error);
				}


				$('#playerList').empty();
				addPlayersToList(players);
				//renderPlayerList(players, 1);
			});
		});
	}


	function editPlayer() {
		var dialog = $('#editPlayerDialog');
		var data   = window.tool.functions.getParamsArr(dialog);

		mithril.actor.editActor(curPlayer.actorId, data, function (error) {
			var msg;

			if (error) {
				msg = $('<span class="error" style="display: none;">Error on Save!</span>');
			} else {
				msg = $('<span class="updated" style="display: none;">Saved!</span>');
			}

			dialog.dialog('close');
			$('.playerHolder[data-id="' + curPlayer.actorId + '"]').append(msg);
			msg.toggle(300);
			setTimeout(function() {
				msg.toggle(300);
				msg.remove();
			}, 4500);
		});
	}



	function loadPlayerDialog() {
		$('.dataValues').empty();

		if (!curPlayer) {
			return console.warn('player data not found for player : ', curPlayer);
		}

		var data  = curPlayer.data;


		var dataFields = '';

		for (var attr in data) {
			var type = typeof data[attr];

			dataFields += window.tool.functions.generatePropField(attr, type, data[attr]);
		}

		$('.dataValues').empty();
		$('.dataValues').append(dataFields);

		$('#editPlayerDialog').dialog('open');
	}



	function addPlayersToList(players) {
		var len = players.length;
		if (len === 0) {
			$('#playerList').append('No players found');
		}


		for (var i = 0; i < len && i < 50; i++) {
			var obj = players[i];

			var li     = $('<li class="playerHolder" data-id="' + obj.actor + '"></li>');
			var button = $('<button class="openPlayerDialog" data-id="' + obj.actor + '">Edit</button>');

			li.append(button).append('<button class="playAs" data-id="' + obj.actor + '">Play</button>' + (obj.data && obj.data.name) + ' ( ' + obj.actor + ' ) ');

			$('#playerList').append(li);
		}
	}


	/**
	*
	* @param players -- list of players
	* @param page  -- page number
	*/

	function renderPlayerList(players, page) {
		$('#actor_pageLinks').empty();

		var len = players.length;
		if (len === 0) {
			$('#playerList').append('No players found');
		}


		for (var i = 0; i < len && i < pageLimit; i++) {
			var obj = players[i];

			var li     = $('<li class="playerHolder" data-id="' + obj.actor + '"></li>');
			var button = $('<button class="openPlayerDialog" data-id="' + obj.actor + '">Edit</button>');

			li.append(button).append('<button class="playAs" data-id="' + obj.actor + '">Play</button>' + (obj.data && obj.data.name) + ' ( ' + obj.actor + ' ) ');

			$('#playerList').append(li);
		}

		if (page > 1) {
			$('#actor_pageLinks').append('<button id="actor_prevPageBtn" data-id="' + (page - 1)  + '">Prev</button>');
		}

		if (len > pageLimit) {
			$('#actor_pageLinks').append('<button id="actor_nextBtn" data-id="' + (page + 1)  + '">Next</button>');
		}
	}
}(window));
