(function () {

	var mithril = window.mithril;
	var viewport = window.viewport;
	if (!app.gachaTool) {
		app.gachaTool = {};
	}
	
	var view = {};
	
	var elm = viewport.getViewElement("tool_gacha");
	
	viewport.setViewHandler({
		name: "tool_gacha",
		obj: view,
		elm: elm
	});
	
	this.curCollection;
	this.curBooster;
	this.collections = [];
	this.cards       = {};
	this.classes     = [];
	this.renderer    = new Renderer();
	this.lib         = new gachaLib();

	var _this = this;

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
	for (var i = 0; i < 60; i++) {
		if (i < 10) {
			time += '<option value="' + i + '">0' + i + '</option>';
		} else {
			time += '<option value="' + i + '">' + i + '</option>';
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
	app.gachaTool.hoursFragment = $(hoursFragment);

	var recurringFragment = '<div class="recurrence"><div class="from">' + time + '</div> to <div class="to">';
	recurringFragment    += time + '</div><button class="removeRecurring">-</button><br />' + day + '</div>';
	app.gachaTool.recurringFragment = $(recurringFragment);

	view.onbeforepaint = function () {
		$('#nav .btn_gacha').css({ color: 'white', background: 'black', "font-weight": 'bold' });
		$('.collectionStage').empty();
		$('#viewport').css('background', 'white');
		var fragment  = '';
		var classes   = window.mithril.obj.getClassesByName();
		this.classes = classes;
		for (var i = 0, len = classes.length; i < len; i++) {
			var id = classes[i].name;
			if (id.match(/^card:/)) {
				fragment += '<li class="cardListItem" data-id="' + id + '">' + classes[i].data.name + '</li>';
				_this.cards[id] = classes[i].data.name;
			}
		}

		$('#cardList ul').append(fragment);

		window.mithril.shop.getShops(['gacha_free', 'gacha_paid'], function (error, results) {
			if (error) {
				alert('Could not read data. ' + error);
			} else {
				_this.collections = results;
				_this.renderer.init(results, _this.cards, _this.lib);
				_this.lib.init(results, _this.curCollection, _this.curBooster, _this.renderer);

				for (var key in results) {
					var ele = _this.renderer.generateCollection(key);
					$('.collectionStage').append(ele);
				}
			}
		});
	};
	
	
	view.onclose = function () {
		$('#viewport').css('background', 'black');
		$('#nav .btn_gacha').css({ color: 'white', background: 'gray', "font-weight": 'normal' });
	};

}());
