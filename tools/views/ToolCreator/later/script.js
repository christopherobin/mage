function ViewToolCreator(app, elm) {

	this.onbeforepaint = function (view) {
		$('#nav .btn_creator').css({ color: 'white', background: 'black', "font-weight": 'bold' });

		var childTree;

		var baseDir        = 'http://$cfg(server.expose.host):$cfg(server.expose.port)/creator';
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

		window.mithril.gc.gm.sync(function (error) {
			if (!error) {

				creator.renderer   = Object.create(Render);							// TODO: rewrite this to follow mithril design patterns
				creator.nodes      = new Nodes();
				creator.graphHdlr  = new Graph(connectionTypes);


				creator.curParent;
				creator.curType;

				$js(module.manage.nodetypes)							// Include the nodetype files. The nodetypes will register themselves in creator.nodes.types

				creator.setup();
			}
		}); 
	};
	
	this.onafterpaint = function (view) {
		
	};
	
	this.onclose = function () {
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
}
