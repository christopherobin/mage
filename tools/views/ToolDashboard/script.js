function ViewToolDashboard(app, elm)
{
	var btn_session    = elm.querySelector('.btn_session');
	var btn_gacha      = elm.querySelector('.btn_gacha');
	var btn_raid       = elm.querySelector('.btn_raid');

	$(btn_session).click(function () {
		app.views.change('tool_session');
	});

	$(btn_gacha).click(function () {
		app.views.change('tool_gacha');
	});

	$(btn_raid).click(function () {
		app.views.change('tool_raid');
	});

	this.onbeforepaint = function (view) {
		$('#nav').hide();
	};
	
	this.onafterpaint = function (view) {
		
	};
	
	this.onclose = function () {
		$('#nav').show();
	};

}
