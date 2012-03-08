function gachaLib() {
	var collections, curCollection, curBooster, renderer, cards, filters;

	this.init = function (cols, cCol, cBooster, render) {
		collections = cols;
		cCollection = cCol;
		curBooster  = cBooster;
		renderer    = render;
		cards       = window.mithril.obj.getClassesByName();
		filters     = {};

		var begintop, beginleft, posTopArray, posLeftArray;
		this.setupHandlers();

		$('#cardList ul').selectable();

		$('#cardList li').draggable({
			revert: true,
			zIndex: 3000,
			helper: 'clone',
			start: function(event, ui) {
				posTopArray = [];
				posLeftArray = [];
				if ($(this).hasClass("ui-selected")) {  // Loop through each element and store beginning start and left positions
					$(".ui-selected").each(function(i) {
						thiscsstop = $(this).css('top');
						thiscssleft = $(this).css('left');
						posTopArray[i] = parseInt(thiscsstop, 10);
						posLeftArray[i] = parseInt(thiscssleft, 10);
					});
				}

				begintop  = $(this).offset().top; // Dragged element top position
				beginleft = $(this).offset().left; // Dragged element left position
			},
			drag: function(event, ui) {
				var topdiff = $(this).offset().top   - begintop;  // Current distance dragged element has traveled vertically
				var leftdiff = $(this).offset().left - beginleft; // Current distance dragged element has traveled horizontally

				if ($(this).hasClass("ui-selected")) {
					$(".ui-selected").each(function(i) {
						$(this).css('top', posTopArray[i] + topdiff); // Move element veritically - current css top + distance dragged element has travelled vertically
						$(this).css('left', posLeftArray[i] + leftdiff); // Move element horizontally - current css left + distance dragged element has travelled horizontally
					});
				}
			}
		});

/*
		$('#cardList li').draggable({
			helper: 'clone'
		});
*/

		// end of init
	};


	this.getCurBooster = function () {
		return curBooster;
	};

	this.getCurCollection = function () {
		return curCollection;
	};

	function openDialog(dialog, type, action) {
		dialog.dialog('open');
		switch (action) {
			case 'add':
				$('#gachaName').val('');
				$('#gachaPriority').val('1');
//				$('#gachaType option[value="gacha_free"]').attr('selected', true);
				$('#shopType').val('');
				$('#gachaHours').empty();
				$('#gachaRecurring').empty();
				dialog.dialog('option', 'title', 'Add ' + type);
				dialog.dialog('option', 'buttons', {
					'Add': function() {
						if (type === 'collection')
							processCollection('addCollection');
						else
							processBooster('addBooster');
					},
					'Cancel': function() { dialog.dialog('close'); }
				});
				break;

			case 'edit':
				switch (type) {
					case 'collection':
						var collection = collections[curCollection];
						var fragment = '';

						$('#gachaName').val(collection.data.name.val || collection.data.name);
						$('#gachaPriority').val(collection.data.priority);
						$('#shopType').val(collection.type);

						$('#gachaHours').empty();
						if (collection.data.hours) {
							for (var i = 0, len = collection.data.hours.length; i < len; i++) {
								fragment = tool.shop.hoursFragment.clone();
								fragment.find('.calendar').datepicker({ showOtherMonths: true, selectOtherMonths: true });

								var hours = collection.data.hours[i];
								var start = new Date(hours[0] * 1000);
								fragment.find('.from .calendar').datepicker('setDate', start);
								fragment.find('.from .hour option[value="' + start.getHours() + '"]').attr('selected', true);
								fragment.find('.from .minute option[value="' + start.getMinutes() + '"]').attr('selected', true);

								var end   = new Date(hours[1] * 1000);
								fragment.find('.to .calendar').datepicker('setDate', end);
								fragment.find('.to .hour option[value="' + end.getHours() + '"]').attr('selected', true);
								fragment.find('.to .minute option[value="' + end.getMinutes() + '"]').attr('selected', true);
								$('#gachaHours').append(fragment);
							}
						}

						$('#gachaRecurring').empty();
						if (collection.data.recurring) {
							for (var j = 0, jlen = collection.data.recurring.length; j < jlen; j++) {
								var recurrence = collection.data.recurring[j];
								fragment = tool.shop.recurringFragment.clone();

								var fromH = parseInt(recurrence.time[0].slice(0, 2), 10);
								var fromM = parseInt(recurrence.time[0].slice(2), 10);

								fragment.find('.from .hour option[value="' + fromH + '"]').attr('selected', true);
								fragment.find('.from .minute option[value="' + fromM + '"]').attr('selected', true);

								fragment.find('.to .hour option[value="' + parseInt(recurrence.time[1].slice(0, 2), 10) + '"]').attr('selected', true);
								fragment.find('.to .minute option[value="' + parseInt(recurrence.time[1].slice(2), 10) + '"]').attr('selected', true);

								var days = recurrence.days;
								for (var k = 0, klen = days.length; k < klen;k++) {
									fragment.find('input:checkbox[name="days"][value="' + days[k] + '"]').attr('checked', true);
								}

								$('#gachaRecurring').append(fragment);
							}
						}

						break;

					case 'booster':
						break;

					default:
						break;
				}

				dialog.dialog('option', 'title', 'Edit ' + type);
				dialog.dialog('option', 'buttons', {
					'Edit': function() {
						if (type == 'collection')
							processCollection('editCollection');
						else
							processBooster('editBooster');
					},
					'Cancel': function() { dialog.dialog('close'); }
				});
				break;

			default:
				break;
		}
	}

	function openDetailDialog(booster) {
		$('#boosterDetailRows').empty();
		var newTop = booster.offset().top + booster.outerHeight() + 30;

		var objects = [];
		var rows    = {};
		if (collections[curCollection] && collections[curCollection].items[curBooster]) {
			objects = collections[curCollection].items[curBooster].objects;
		}

		if (objects) {
			for (var i = 0, len = objects.length; i < len; i++) {
				var rowId = objects[i].data.row;
				if (!rows[rowId]) {
					rows[rowId] = {};
				}

				rows[rowId][objects[i].className] = { weight: objects[i].data.weight, dbid: objects[i].id };
			}

			for (var key in rows) {
				var row = renderer.generateRow(rows[key], key);
				$('#boosterDetailRows').append(row);
			}
		}

		$('#boosterDetail').show();
		$('#boosterDetail').offset({ top: newTop });
	}

	function processCollection(action) {
		var hours = [];
		var recurring = [];
		$('#gachaHours .interval').each(function () {
			var start = parseInt($(this).find('.from .calendar').datepicker('getDate').getTime() / 1000, 10);
			start += (parseInt($(this).find('.from .hour option:selected').val(), 10) * 3600) + (parseInt($(this).find('.from .minute option:selected').val(), 10) * 60);

			var end = parseInt($(this).find('.to .calendar').datepicker('getDate').getTime() / 1000, 10);
			end += (parseInt($(this).find('.to .hour option:selected').val(), 10) * 3600) + (parseInt($(this).find('.to .minute option:selected').val(), 10) * 60);

			hours.push([start, end]);
		});


		$('#gachaRecurring .recurrence').each(function () {
			var days = [];
			$(this).find('input:checkbox[name="days"]:checked').each(function () {
				days.push(parseInt($(this).val(), 10));
			});

			var startH = $(this).find('.from .hour option:selected').val();
			var startM = $(this).find('.from .minute option:selected').val();

			if (parseInt(startH, 10) < 10)
				startH = 0 + startH;

			if (parseInt(startM, 10) < 10)
				startM = 0 + startM;

			var start = startH + startM;

			var endH = $(this).find('.to .hour option:selected').val();
			var endM = $(this).find('.to .minute option:selected').val();

			if (parseInt(endH, 10) < 10)
				endH = 0 + endH;

			if (parseInt(endM, 10) < 10)
				endM = 0 + endM;

			var end = endH + endM;

			var time = [start, end];

			var recurrence = {
				days: days,
				time: time
			};

			recurring.push(recurrence);
		});

		var name     = $('#gachaName').val();
		var type     = $('#shopType').val();
		var priority = parseInt($('#gachaPriority').val() || 0, 10);
		var identifier = $('#shopType').val();
		var prefix;

		// params = { prefix: 'gacha:', type: 'gacha_free', data: { priority: 4, name: 'blah, hours: [[], []], recurring: [{}, {}]  } };   'ish
		var data = {
			name: { val: name, lang: 'EN' },
			priority: priority
		};


		if (hours.length > 0) {
			data.hours = hours;
		}

		if (recurring.length > 0) {
			data.recurring = recurring;
		}

		var sendData = flattenProperties(data);

		if (action === 'addCollection') {
			mithril.shop.createShop(identifier, prefix, type, sendData, function (error, newId) {
				collections[newId] = {
					type: type,
					items: {},
					data: data
				};

				var ele = renderer.generateCollection(newId);
				$('.collectionStage').append(ele);
				$('#collectionDialog').dialog('close');
			});

		} else if (action === 'editCollection') {
			data.identifier = curCollection;
			mithril.shop.editShop(data.identifier, type, sendData, function (error) {
				if (error) {
					return alert('Could not save collection : ' + name);
				}
				$('.collection[data-id="' + curCollection + '"] .actions .name').html(name);
				var col   = collections[curCollection];
				col.type  = type;
				col.data  = data;

				$('#collectionDialog').dialog('close');
			});
		}
	}

	function processBooster(action) {
		var name = $('#boosterName').val();
		var weight = parseInt($('#boosterWeight').val() || 0, 10);
		var currencyType = $('#boosterCurrency').val();
		var cost = parseInt($('#boosterPrice').val() || 0, 10);
		var identifier, prefix;

		var data = {
			name: { val: name, lang: 'EN' },
			weight: weight
		};

		var sendData = flattenProperties(data);

		// identifier, prefix, currencyType, unitPrice, shopIdentifier, data
		mithril.shop.createItem(identifier, prefix, currencyType, cost, curCollection, sendData, function (error, id) {
			var collection = collections[curCollection];
			if (!collection.items) {
				collection.items = {};
			}

			// TODO: test this, not sure if objects should be an array or object
			collection.items[id] = { unitPrice: cost, data: data, objects: [] };
			renderer.addToCollection(id, 'booster', $('.collection[data-id="' + curCollection + '"]'));
			$('#boosterDialog').dialog('close');
		});
	}

	function editBooster(booster) {
		var name = booster.find('.boosterName').val();
		var weight = parseInt(booster.find('.boosterWeight').val(), 10);
		var cost = parseInt(booster.find('.boosterCost').val(), 10);

		var data = {
			name: { val: name, lang: 'EN' },
			weight: weight
		};

		var sendData = flattenProperties(data);

		mithril.shop.editItem(curBooster, cost, sendData, function (error) {
			if (!error) {
				var obj = collections[curCollection].items[curBooster];
				obj.data = data;
				obj.unitPrice = cost;
			} else {
				alert('Could not edit item. ' + error);
			}
		});
	}

	function editGacha(card) {
		var id = card.attr('data-dbid');
		var data = {
			weight: parseInt(card.find('.gachaRate').val(), 10)
		};

		var sendData = flattenProperties(data);

		mithril.shop.editItemObject(id, sendData, function (error) {
			if (error) {
				alert('Couldn\'t edit card . ' + error);
			}

			var objects = collections[curCollection].items[curBooster].objects;
			for (var i = 0, len = objects.length; i < len; i++) {
				if (id == objects[i].id) {
					objects[i].data.weight = data.weight;
				}
			}
		});
	}


	function filterCards() {
		$('#cardList li').hide();

		for (var i = 0, len = cards.length; i < len; i++) {
			var card = cards[i];

			if (filters.name) {
				if (card.data.name.toLowerCase().indexOf(filters.name.toLowerCase()) === -1) {
					continue;
				}
			}


			if (filters.rank) {
				if (card.data.rank != filters.rank) {
					continue;
				}
			}

			// pass all tests, show card
			$('#cardList li[data-id="' + card.name + '"]').show();
		}
	}


//**********************************************
//
//	UI Stuff
//
//**********************************************


	this.setupHandlers = function () {
		var boosterTimeout;
		var cardTimeout;

		var hFrom = $('#historyFrom').datepicker({ showOtherMonths: true, selectOtherMonths: true });
		var hTo = $('#historyTo').datepicker({ showOtherMonths: true, selectOtherMonths: true });

		$('#historySearch').click(function (){
			var sFrom = null;
			var sTo = null;
			if (hFrom.datepicker('getDate')) {
				sFrom = parseInt((hFrom.datepicker('getDate').getTime() / 1000), 10);
			}
			if (hTo.datepicker('getDate')) {
				sTo = parseInt((hTo.datepicker('getDate').getTime() / 1000), 10);
			}
			var sActorId = $('#historyActorId').val();

			mithril.shop.getPurchaseHistory(sFrom, sTo, sActorId, function (err, data) {
				if (err) {
					return;
				}
				if (data && data.length) {
					var html = '<table><tr>';
					for (var header in data[0]) {
						html += '<th>' + header + '</th>';
					}
					for (var i = 0, len = data.length; i < len; i+= 1) {
						var row = data[i];
						html += '<tr>';
						for (var col in row) {
							html += '<td>';
							html += row[col];
							html += '</td>';
						}
						html += '</tr>';
					}
					html += '</tr></table>';
					$('#historyResults')[0].innerHTML = html;
				}
			});
		});

		$('#tabs div').click(function() {
			var tab = $(this).attr('data-id');
			$('#tabs div').removeClass('activeTab');
			$(this).addClass('activeTab');

			$('.toolDependency').hide();
			$('.toolDependency[data-dependency="' + tab + '"]').show();

			$('.stage').hide();
			$('.stage[data-id="' + tab + '"]').show();
		});

		$('.addHours').click(function() {
			var fragment = tool.shop.hoursFragment.clone();
			fragment.find('.calendar').datepicker({ showOtherMonths: true, selectOtherMonths: true });
			$('#gachaHours').append(fragment);
		});

		$('.addRecurring').click(function() {
			var fragment = tool.shop.recurringFragment.clone();
			$('#gachaRecurring').append(fragment);
		});

		$('.removeHours').live('click', function() {
			$(this).parents('.interval').remove();
		});

		$('.removeRecurring').live('click', function() {
			$(this).parents('.recurrence').remove();
		});

		$('button.addBtn').live('click', function() {
			var action = $(this).attr('data-id');
			switch (action) {
				case 'addCollection':
					curCollection = '';
					openDialog($('#collectionDialog'), 'collection', 'add');
					break;

				case 'addBooster':
					curBooster = '';
					curCollection = $(this).parents('.collection').attr('data-id');
					openDialog($('#boosterDialog'), 'booster', 'add');
					break;

				case 'addRow':
					var id  = $('#boosterDetailRows .boosterRow').length + 1;
					var row = renderer.generateRow([], id);
					$('#boosterDetailRows').append(row);
					break;

				default:
					break;
			}
		});

		$('button.editBtn').live('click', function() {
			var action = $(this).attr('data-id');
			switch (action) {
				case 'editCollection':
					curCollection = $(this).parents('.collection').attr('data-id');
					openDialog($('#collectionDialog'), 'collection', 'edit');
					break;

				case 'editBooster':
					curBooster = $(this).parents('.booster').attr('data-id');
					curCollection = $(this).parents('.collection').attr('data-id');
					openDialog($('#boosterDialog'), 'booster', 'edit');
					break;

				default:
					break;
			}
		});

		$('.booster input').live('keyup mouseup change', function(event) {
			var booster = $(this).parents('.booster');
			clearTimeout(boosterTimeout);
			if (event.type == 'change') {
				editBooster(booster);
			} else {
				boosterTimeout = setTimeout(function() {
					editBooster(booster);
				}, 1500);
			}
		});

		$('.card input').live('keyup mouseup change', function(event) {
			var card = $(this).parents('.card');
			clearTimeout(cardTimeout);
			if (event.type == 'change') {
				editGacha(card);
			} else {
				cardTimeout = setTimeout(function() {
					editGacha(card);
				}, 1500);
			}
		});

		$('.removeCollection').live('click', function() {
			var collection = $(this).parents('.collection');
			var id         = collection.attr('data-id');

			mithril.shop.deleteShop(id, function (error) {
				if (error) {
					alert('Couldn\'t delete gacha ' + collection + ' : ' + error);
				} else {
					delete collections[collection.attr('data-id')];
					collection.remove();
				}
			});
		});

		$('.removeCard').live('click', function() {
			var card = $(this).parents('.card');
			var row  = $(this).parents('.boosterRow');
			var id   =  card.attr('data-dbid');

			mithril.shop.deleteItemObject(id, function (error) {
				if (error) {
					alert('Couldn\'t delete card from item. ' + error);
				}

				var objects = collections[curCollection].items[curBooster].objects;
				for (var i = 0, len = objects.length; i < len; i++) {
					if (id == objects[i].id) {
						objects.splice(i, 1);
						break;
					}
				}
				card.remove();
			});
		});

		$('.removeBooster').live('click', function(e) {
			var booster    = $(this).parents('.booster');
			var collection = $(this).parents('.collection');

			var shopIdentifier = collection.attr('data-id');
			var itemIdentifier = booster.attr('data-id');

			mithril.shop.deleteItem(shopIdentifier, itemIdentifier, function (error) {
				if (error) {
					alert('Could not remove booster. ', error);
				} else {
					delete collections[shopIdentifier].items[itemIdentifier];
					booster.remove();
				}
			});
			e.preventDefault();
			return false;
		});

		$('.removeBoosterRow').live('click', function(e) {
			if (!confirm('Are you sure you want to delete this item?')) {
				e.preventDefault();
				return false;
			}
			var ids   = [];
			var row   = $(this).parents('.boosterRow');
			var rowId = row.attr('data-id');
			row.find('.card').each(function () {
				ids.push(parseInt($(this).attr('data-dbid'), 10));
			});

			mithril.shop.deleteItemObjects(ids, function (error) {
				if (error) {
					alert('Couldn\'t delete row. ' + error);
				}

				var objects = collections[curCollection].items[curBooster].objects;
				var newObjs = [];
				for (var i = 0, len = objects.length; i < len; i++) {
					if (ids.indexOf(objects[i].id) == -1) {
					// If I need to change row after row deletion, a pain...

	//					if (parseInt(objects[i].data.row) > parseInt(rowId)) {
	//						objects[i].data.row = parseInt(objects[i].data.row) - 1;
	//					}
						newObjs.push(objects[i]);
					}
				}

	/*
				row.nextAll('.boosterRow').each(function () {
					var newRow = parseInt($(this).attr('data-id')) - 1;
					$(this).attr('data-id', newRow);
				});

	*/
				collections[curCollection].items[curBooster].objects = newObjs;

				row.remove();
			});
		});

		$('.booster').live('click', function() {
			$('.booster').removeClass('curBooster');
			$(this).addClass('curBooster');
			curBooster    = $(this).attr('data-id');
			curCollection = $(this).parents('.collection').attr('data-id');
			openDetailDialog($(this));
		});

		$('#boosterDetail .minBtn').live('click', function() {
			$(this).parents('#boosterDetail').hide();
		});

		$('#filterCards').keyup(function() {
			var search = $(this).val();

			if (search !== '') {
				filters.name = search;
			} else {
				delete filters.name;
			}

			filterCards();
		});

		$('.cardRarity').change(function () {
			var rarity = $(this).find('option:selected').val();
			if (rarity === 'all') {
				delete filters.rank;
			} else {
				filters.rank = rarity;
			}

			filterCards();
		});

		$('input[name="all"]').change(function () {
			if ($(this).attr('checked')) {
				$('#cardList li:visible').addClass('ui-selected');
			} else {
				$('#cardList li').removeClass('ui-selected');
			}
		});


		$('#collectionDialog').dialog({
			autoOpen:   false,
			height:     'auto',
			width:      'auto',
			modal:      true,
			zIndex:     10000
		});

		$('#boosterDialog').dialog({
			autoOpen:   false,
			height:     'auto',
			width:      'auto',
			modal:      true,
			zIndex:     10000,
			open: function() {
				$('#boosterName').val('');
			}
		});
	};
}