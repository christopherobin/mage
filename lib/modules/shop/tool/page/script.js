$html5client('module.shop');

(function (window) {
	var mage = window.mage;

	var shop = {};
	var setup = false;

	window.tool.shop = shop;

	shop.curCollection = 0;
	shop.curBooster    = 0;

	shop.collections = [];
	shop.cards       = {};
	shop.classes     = [];
	shop.renderer    = new Renderer();
	shop.lib         = new gachaLib();


	var interval = '<input class="calendar" /> ';
	var time = '<select class="hour">';
	for (var i = 1; i <=24; i++) {
		if (i < 10) {
			time += '<option value="' + i + '">0' + i + '</option>';
		} else {
			time += '<option value="' + i + '">' + i + '</option>';
		}
	}

	time += '</select>:<select class="minute">';

	for (var j = 0; j < 60; j++) {
		if (j < 10) {
			time += '<option value="' + j + '">0' + j + '</option>';
		} else {
			time += '<option value="' + j + '">' + j + '</option>';
		}
	}
	time += '</select>';
	interval += time;

	var day = '';
	day += '<input type="checkbox" name="days" value="0" /> Su';
	day += '<input type="checkbox" name="days" value="1" /> Mo';
	day += '<input type="checkbox" name="days" value="2" /> Tu';
	day += '<input type="checkbox" name="days" value="3" /> We';
	day += '<input type="checkbox" name="days" value="4" /> Th';
	day += '<input type="checkbox" name="days" value="5" /> Fr';
	day += '<input type="checkbox" name="days" value="6" /> Sa';

	var hoursFragment = '<div class="interval"><div class="from">' + interval;
	hoursFragment    += '</div> to <div class="to">' + interval + '</div><button class="removeHours">-</button></div>';
	shop.hoursFragment = $(hoursFragment);

	var recurringFragment = '<div class="recurrence"><div class="from">' + time + '</div> to <div class="to">';
	recurringFragment    += time + '</div><button class="removeRecurring">-</button><br />' + day + '</div>';
	shop.recurringFragment = $(recurringFragment);



	mage.loader.on('shop.display', function () {
		if (!setup) {
			setup = true;

			mage.setupModules(['actor', 'obj', 'shop'], function (error) {
				if (error) {
					return console.error(error);
				}


				var fragment = '';
				var classes = shop.classes = mage.obj.getClassesByName();
				for (var i = 0, len = classes.length; i < len; i++) {
					var id = classes[i].name;
					if (id.match(/^card:/)) {
						fragment += '<li class="cardListItem" data-id="' + id + '">' + classes[i].data.name + '</li>';
						shop.cards[id] = classes[i].data.name;
					}
				}

				$('#cardList ul').append(fragment);

				// ENDTODO


				mage.shop.getShops(null, function (error, results) {
					if (error) {
						alert('Could not read data. ' + error);
					} else {
						shop.collections = results;
						shop.renderer.init(results, shop.cards, shop.lib);
						shop.lib.init(results, shop.curCollection, shop.curBooster, shop.renderer);

						for (var key in results) {
							var ele = shop.renderer.generateCollection(key);
							$('.collectionStage').append(ele);
						}
					}
				});

			});
		}
	});

}(window));
