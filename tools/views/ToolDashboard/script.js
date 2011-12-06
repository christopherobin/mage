(function () {

	var viewport = window.viewport;
	
	var view = {};
	
	var elm = viewport.getViewElement("tool_dashboard");
	
	viewport.setViewHandler({
		name: "tool_dashboard",
		obj: view,
		elm: elm
	});
	
	var btn_session    = elm.querySelector('.btn_session');
	var btn_gacha      = elm.querySelector('.btn_gacha');
	var btn_raid       = elm.querySelector('.btn_raid');

	$(btn_session).click(function () {
		viewport.change('tool_session');
	});

	$(btn_gacha).click(function () {
		viewport.change('tool_gacha');
	});

	$(btn_raid).click(function () {
		viewport.change('tool_raid');
	});

	view.onbeforepaint = function () {
		$('#nav').hide();
	};
	
	view.onafterpaint = function () {
		
	};
	
	view.onclose = function () {
		$('#nav').show();
	};

}());
