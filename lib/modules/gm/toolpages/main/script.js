$html5client('io');
$html5client('datatypes');
$html5client('modulesystem');
$html5client('module.assets');
$html5client('module.session');
$html5client('module.gm');

$file.bin("../../toolpages/lib/jquery-1.7.js");
$file.bin("../../toolpages/lib/jqueryui/jquery-ui-1.8.16.custom.js");
$file.bin("../../toolpages/lib/jquery.contextMenu.js");
$file.bin("../../toolpages/lib/jquery.jsPlumb-1.3.3-all.js");
$dir("../../toolpages/lib/general");



if (!window.tool) {
	window.tool = {};
}

var mod = {};

window.tool.mod = mod;
var mithril = window.mithril;

window.mithril.loader.on('main.loaded', function () {
	window.mithril.loader.displayPage('main');
	mithril.configure({});


	$('.toolLink').live('click', function () {
		var target = $(this).attr('data-target');
		mithril.loader.displayPage(target);
		var page = $('.mithril-page[data-page="' + target + '"]');
		if (page.find('.headerNav').length === 0) {
			page.prepend($('#dashboardMenu').clone().addClass('headerNav'));
		}
	});


	$('#loginHolder #user').focus();


	$('#loginHolder input').keypress(function (event) {
		if (event.which === 13) {
			$('#loginHolder #login').click();
			event.preventDefault();
			return false;
		}
	});


	$('#login').click(function () {
		var username = $('#user').val();
		var password = $('#password').val();

		window.mithril.gm.login(username, password, function (error, session) {
			if (error) {
				return $('#loginError').show();
			}


			var options = {io: {defaultHooks: ['mithril.session']}};
			mithril.configure(options);
			mithril.session.setSessionKey(session);


			// register what to do if there is io error
			mithril.io.on('io.error', function (path, error) {
				console.error(error);
			});


			mithril.setup(function (error) {
				if (error) {
					return console.log(error);
				} else {
					console.log('ready');

					mithril.gm.getTools(function (error, toolsList) {
						if (error) {
							return console.error('Something bad happened, unable to retrieve list of available tools. ', error);
						}

						var game = toolsList.indexOf('game');
						if (game !== -1) {
							toolsList.splice(game, 1);
						}

						mithril.loader.loadPages(toolsList);
						for (var i = 0, len = toolsList.length; i < len; i++) {
							var tool = toolsList[i];
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
