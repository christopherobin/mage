function Renderer() {
	var _this = this;
	var cards;
	var collections;
	var gFuncs;


	this.init = function (cols, cCards, gachaFunctions) {
		cards         = cCards;
		collections   = cols;
		gFuncs        = gachaFunctions;
	}


	var rowDropOptions = {
		activeClass: "draggable-active",
		hoverClass: "draggable-hover",
		accept: ".cardListItem:not(.ui-sortable-helper)",
		drop: function( event, ui ) {
			var itemObjects = [];
			var row       = $(this);
			var rowId     = row.attr('data-id');
			curBooster    = gFuncs.getCurBooster();
			curCollection = gFuncs.getCurCollection();

			$('.ui-selected').not('.ui-draggable-dragging').each(function () {
				var id = $(this).attr('data-id');

				itemObjects.push({
					itemIdentifier: curBooster,
					className: id,
					quantity: 1,
					data: {
						row: rowId,
						weight: 1
					}
				});
			});


			itemObjects.filter(function (itemObject, index, array) {
				return (row.find('.card[data-id="' + itemObject.className + '"]').length === 0)
			});

			app.mithril.shop.createItemObjects(itemObjects, function (error, objectIds) {		// TODO: This is hack as hell
				for (var i = 0, len = objectIds.length; i < len; i++) {
					if (!collections[curCollection]['items'][curBooster]['objects']) {
						collections[curCollection]['items'][curBooster]['objects'] = [];
					}

					delete itemObjects[i]['itemIdentifier'];
					itemObjects[i].id = objectIds[i];

					collections[curCollection]['items'][curBooster]['objects'].push(itemObjects[i]);
					_this.addItemToRow(row, itemObjects[i].className, { weight: 1, dbid: objectIds[i] });
				}
			});
		}
	};

	var collectionDropOptions = {
		activeClass: "draggable-active",
		hoverClass: "draggable-hover",
		accept: ".booster:not(.ui-sortable-helper)",
		drop: function( event, ui ) {
// TODO:: For dropping boosters from one shop to another
/*
			var id = ui.draggable.attr('data-id');
			var collection = this;

			if ($(collection).find('.card[data-id="' + id + '"]').length == 0) {
				var options = {
					data: {
						action: 'addGacha',
						card: id,
						collection: $(collection).attr('data-id'),
						type: 'free'			// TODO:: check to make sure if default should be free?
					},
					success: function(data) {
						if (data.status == 'OK')
							_this.addToCollection(id, 'card', collection);
					}
				};
				ajaxCall(options);
			} else {
				alert('Card already exists in collection');
			}
*/
		}
	};


	this.addToCollection = function (id, type, collection) {
		var obj;
		switch (type) {
			case 'booster':
				obj = this.generateBooster(id, collection);
				if (obj)
					$(collection).append(obj);
				break;

			default:
				break;
		}
	}

	this.addItemToRow = function(row, card, data) {
		var item = this.generateCard(card, data);
		row.append(item);
	}

	this.generateCollection = function(id) {
		var collect = collections[id];
		if (collect) {
			var fragment = '<div class="collection"><div class="actions"><button class="addBtn" data-id="addBooster">Add</button><button class="editBtn" data-id="editCollection">Edit</button>';
			fragment += '<span class="name">' + (collect.data.name.val || collect.data.name) + '</span><button class="removeCollection removeBtn">x</button><br /></div></div>';
			
			var collection = $(fragment).droppable(collectionDropOptions);
			collection.attr('data-id', id);
			if (collect.items) {
				for (var key in collect.items) {
					this.addToCollection(key, 'booster', collection);
				}
			}
			return collection;
		}
	}

	this.generateCard = function(id, data) {
		var card = cards[id];
		if (card) {
			var fragment = '<div class="card" data-id="' + id + '" data-dbid="' + data.dbid + '"><button class="removeCard removeBtn">x</button><div class="cardData">';
			fragment += '<div class="label">' + card + '</div><input type="number" class="gachaRate" '; 
			fragment += ((data.weight) ? 'value="' + data.weight + '" ' : '') + '/> <div class="cardIdLabel">' + id + '</div> </div></div>';
			var ele = $(fragment).draggable({
				helper: 'clone'
			});
			return ele;
		}
	}

	this.generateBooster = function(id, collection) {
		var colId = collection.attr('data-id');
		var booster = collections[colId]['items'][id];	// TODO:: check first before using
		var fragment  = '<div class="booster" data-id="' + id + '"><button class="removeBooster removeBtn">x</button><div class="boosterData"><div class="label" >Name</div>';
		fragment     += '<input type="text" class="boosterName" value="' + (booster.data.name.val || booster.data.name) + '" /><br />';
		fragment     += '<div class="label">Weight</div><input type="number" class="boosterWeight" value="' + (booster.data.weight || 0) + '" /></div></div>';
		var ele = $(fragment).draggable({
			helper: 'clone'
		});
		return ele;
	}

	this.generateRow = function(row, id) {
		var fragment = '<div class="boosterRow" data-id="' + id + '"><div class="actions"><span class="name">Item</span><button class="removeBoosterRow removeBtn">x</button></div></div>';
		var ele = $(fragment).droppable(rowDropOptions);

		for (var key in row) {
			var obj = this.generateCard(key, row[key]);
			ele.append(obj);
		}

		return ele;
	}
}
