(function () {
	var mithril = window.mithril;
	var viewport = window.viewport;
	
	var view = {};
	
	var elm = viewport.getViewElement("tool_creator");
	
	viewport.setViewHandler({
		name: "tool_creator",
		obj: view,
		elm: elm
	});
	
	var origin = 'http://$cfg(server.clientHost.expose.host):$cfg(server.clientHost.expose.port)';


	view.onbeforepaint = function (view) {
		$('#nav .btn_creator').css({ color: 'white', background: 'black', "font-weight": 'bold' });

		var childTree;

		var nodeHandler    = {};
		var renderFlag     = false;
		var popupType      = 'normal';
		var spinnerVisible = false;
		var pasteBuffer    = {
			type: '',
			buffer: []
		};

		var nodeList       = {};
		var nodeListArr    = [];
		var curNodes       = {};

		var creator        = new Cardgame();
		window.app.creator = creator;

		window.mithril.gc.gmsync(function (error, nodes) {
			if (!error) {

				creator.nodes      = new Nodes(nodes);

				creator.curParent;
				creator.curType;

				window.mithril.assets.getAssetMaps([], function (error, maps) {
					window.app.creator.assetMaps = maps;
					$config("module.gm.nodetypes");

					creator.graphHdlr  = new Graph(creator.config.connectionTypes);
					creator.renderer   = Object.create(Render);
					creator.setup();
				});
			}
		}); 
	};
	
	view.onafterpaint = function (view) {
		
	};
	
	view.onclose = function () {
		$('#nav .btn_creator').css({ color: 'white', background: 'gray', "font-weight": 'normal' });
	};

	function getValue(value) {
		if (value === undefined || value === null) {
			return '';
		}

		return value.toString();
	}

	function getParams(type, dialog) {
		var params = {};
		dialog.find('input').each(function () {
			var property = $(this).attr('data-property');
			var type     = $(this).attr('data-type');
			var value    = $(this).val();
			switch (type) {
				case 'number':
					params[property] = parseInt(value);
					break;

				case 'object':
					if (property === 'collectionsComplete' && value === '') {
						value = [];
					} else if (property === 'lastQuestId' && value === '') {
						value = '';
					} else {
						value = JSON.parse(value);
					}

					params[property] = value;
					break;

				case 'string':
				default:
					params[property] = value;
					break;
			}
		});

		return params;
	}
}());
