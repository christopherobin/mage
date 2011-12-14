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

		var creator        = window.app.creator = new Cardgame();			// instantiate creator variable with whatever game class you're using

		window.mithril.gc.gmsync(function (error, nodes) {
			if (!error) {

				creator.nodes      = new Nodes(nodes);
				creator.graphHdlr  = new Graph(connectionTypes);


				creator.curParent;
				creator.curType;

				window.mithril.assets.getAssetMaps([], function (error, maps) {
					window.app.creator.assetMaps = maps;
					console.log('assets', window.app.creator.assetMaps);
					$config("module.gm.nodetypes");							// Include the nodetype files. The nodetypes will register themselves in creator.nodes.types

					creator.renderer   = Object.create(Render);				// TODO: rewrite this to follow mithril design patterns
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
