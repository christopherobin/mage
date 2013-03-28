$html5client('io');
$html5client('datatypes');
$html5client('modulesystem');
$html5client('module.assets');
$html5client('module.archivist');
$html5client('module.session');
$html5client('module.gm');

$file.bin("../../toolpages/lib/jquery-1.7.js");
$file.bin("../../toolpages/lib/jqueryui/jquery-ui-1.8.16.custom.js");
$file.bin("../../toolpages/lib/jquery.contextMenu.js");
$file.bin("../../toolpages/lib/jquery.jsPlumb-1.3.3-all.js");
$dir("../../toolpages/lib/general");


window.mage.loader.on('main.loaded', function () {
	var mage = window.mage;

	if (!window.tool) {
		window.tool = {};
	}

	var mod           = {};
	var availableMods = [];

	window.tool.functions     = mod;
	window.tool.availableMods = availableMods;



	window.mage.loader.displayPage('main');
	mage.configure({});

	var curTool   = '';
	var loggingIn = false;

	$('.toolLink').live('click', function () {
		var target = $(this).attr('data-target');
		if (target !== curTool) {
			curTool = target;

			$('.mage-page').hide();

			mage.loader.displayPage(target);

			var page = $('.mage-page[data-page="' + target + '"]');
			if (page.find('.headerNav').length === 0) {
				page.prepend($('#dashboardMenu').clone().addClass('headerNav'));
			}

			$('.toolLink').removeClass('activeTool');
			$('.toolLink[data-target="' + target + '"]').addClass('activeTool');
		}
	});


	$('#loginHolder #user').focus();


	$('#loginHolder input').keypress(function (event) {
		if (event.which === 13 && !loggingIn) {
			$('#loginHolder #login').click();
			event.preventDefault();
			return false;
		}
	});

	// Property Map dialog handlers/functions

	function addProperty() {
		var dialog = window.tool[curTool].addPropertyDialog;
		var dlg = $('#addPropertyDialog');

		var property = dlg.find('input[data-id="property"]').val();

		if (dialog.find('.dataField[data-id="' + property + '"]').length !== 0) {
			return alert('Property ' + property + ' already exists');
		}

		var type = dlg.find('select[data-id="type"] option:selected').val();
		var value = dlg.find('.value[data-type="' + type + '"] input, .value[data-type="' + type + '"] textarea').val();
		if (type === 'boolean') {
			value = dlg.find('.value[data-type="boolean"] input:checked').length > 0;
		}

		var ele = mod.generatePropField(property, type, value);
		dialog.find('.dataValues').append(ele);
		dlg.dialog('close');
	}


	$('.removeProperty').live('click', function () {
		$(this).parents('.dataField').remove();
	});


	$('#addPropertyDialog select').live('change', function () {
		var dlg = $(this).parents('#addPropertyDialog');
		var type = $(this).find('option:selected').val();
		dlg.find('.value').hide();
		dlg.find('.value[data-type="' + type + '"]').show();
	});


	$('#addPropertyDialog').dialog({
		autoOpen: false,
		width: 400,
		modal: true,
		title: 'Add property...',
		open: function () {
			$(this).find('option[value="number"]').attr('selected', true);
			$(this).find('input, textarea').val('');
			$(this).find('.value').hide();
			$(this).find('.value[data-type="number"]').show();
		},
		buttons: [
			{
				text: 'Cancel',
				click: function () {
					$(this).dialog('close');
				}
			},
			{
				text: 'Add',
				click: function () {
					addProperty();
				}
			}
		]
	});


	mod.getParams = function (dialog) {
		var params = {};

		dialog.find('.dataValues input, .dataValues textarea').each(function () {
			var property = $(this).attr('data-property');
			var type     = $(this).attr('data-type');
			var value    = $(this).val();
			switch (type) {
			case 'number':
				params[property] = parseInt(value, 10);
				break;

			case 'object':
				params[property] = JSON.parse(value);
				break;

			case 'bool':
				params[property] = $(this).is(':checked');
				break;

			case 'string':
				var lang = $(this).attr('data-language') || '';
				params[property] = { val: value, lang: lang };
				break;

			default:
				break;
			}
		});

		return params;
	};


	mod.getParamsArr = function (dialog) {
		var params = [];
		dialog.find('input, textarea').each(function () {
			var property = $(this).attr('data-property');
			var type     = $(this).attr('data-type');
			var value    = $(this).val();
			switch (type) {
			case 'number':
				params.push({ property: property, value: parseInt(value, 10) });
				break;

			case 'object':
				params.push({ property: property, value: JSON.parse(value) });
				break;

			case 'bool':
				params.push({ property: property, value: $(this).is(':checked') });
				break;

			case 'string':
				var param = { property: property, value: value };
				var lang = $(this).attr('data-language');
				if (lang !== '') {
					param.language = lang;
				}

				params.push(param);
				break;

			default:
				break;
			}
		});

		return params;
	};


	mod.generatePropField = function (attr, type, data) {
		var input = '';
		var prop = '<div class="propName">' + attr + '<button class="removeProperty removeBtn">X</button></div>';

		input += '<div class="dataField" data-id="' + attr + '">';

		switch (type) {
		case 'number':
			input += prop + ' <input type="number" data-type="number" data-property="';
			input += attr + '" value="' + data + '" />';
			break;

		case 'string':
			input += prop + ' <input type="text" data-type="string" data-property="';
			input += attr + '" value="' + data + '" />';
			break;

		case 'boolean':
			input += prop + '<input type="checkbox" data-type="bool" data-property="';
			input += attr + '" ' + ((data) ? 'checked' : '') + ' />';
			break;

		case 'object':
			input +=  prop + '<textarea rows="4" cols="55" data-type="object" data-property="' + attr + '">';
			input += JSON.stringify(data) + '</textarea>';
			break;

		default:
			break;
		}

		input += '</div>';

		return input;
	};



	$('#login').click(function () {
		if (loggingIn) {
			return false;
		}

		var username = $('#user').val();
		var password = $('#password').val();
		loggingIn = true;

		window.mage.gm.login(username, password, function (error, response) {
			if (error) {
				loggingIn = false;
				return $('#loginError').show();
			}

			var session = response.sessionKey;
			var rights  = response.rights;

			mage.session.setSessionKey(session);


			// register what to do if there is io error
			mage.io.on('io.error', function (path, error) {
				console.error(error);
			});


			mage.setup(function (error) {
				if (error) {
					return console.log(error);
				} else {
					console.log('ready');

					mage.gm.getTools(function (error, toolsList) {
						if (error) {
							return console.error('Something bad happened, unable to retrieve list of available tools. ', error);
						}

						var linkList = [];

						function filterRights(tool) {
							if (!rights[tool]) {
								return false;
							}

							if (rights[tool].viewable) {
								linkList.push(tool);
							}

							return true;
						}

						var loadList = toolsList.filter(filterRights);
						window.tool.availableMods = toolsList;

						mage.loader.loadPages(loadList);

						for (var i = 0, len = linkList.length; i < len; i++) {
							var tool = linkList[i];
							var toolLink = '<div class="toolLink" data-target="' + tool + '">' + tool + '</div>';
							$('#dashboardMenu').append(toolLink);
						}

						$('#loginContainer').hide();
						$('#dashboardMenu').show();
					});
				}
			});
		});
	});
});
