$html5client(io);
$html5client(datatypes);
$html5client(modulesystem);
$html5client(module.gm);

$file.bin("../../toolpages/lib/jquery-1.7.js");
$file.bin("../../toolpages/lib/jqueryui/jquery-ui-1.8.16.custom.js");
$file.bin("../../toolpages/lib/jquery.contextMenu.js");
$file.bin("../../toolpages/lib/jquery.jsPlumb-1.3.3-all.js");
$dir("../../toolpages/lib/general");


function loadModules() {
	// TODO: Loop through available modules and see if they expose a tool.
	// If so, add it to the toolList (in the future possibly finegrain control which tools are available to which admin account

	$html5client(module.assets);
	$html5client(module.session);
	$html5client(module.gc);
	$html5client(module.npc);
}



window.mithril.loader.on('main.loaded', function () {
	window.mithril.loader.displayPage('main');
	mithril.configure({});


	$('.toolLink').live('click', function () {
		var target = $(this).attr('data-target');
		mithril.loader.loadPage(target);
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
		var username = document.getElementById('user').value;
		var password = document.getElementById('password').value;

		window.mithril.gm.login(username, password, function (error, session) {
			if (error) {
				return $('#loginError').show();
			}

			loadModules();

			var options = { io: { defaultHooks: ['mithril.session'] } };
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

						for (var i = 0, len = toolsList.length; i < len; i++) {
							var toolLink = '<div class="toolLink" data-target="' + toolsList[i] + '">' + toolsList[i] + '</div>';
							$('#dashboardMenu').append(toolLink);
						}

						var loginEle = document.getElementById('loginContainer');
						loginEle.style.display = 'none';

						var toolList = document.getElementById('dashboardMenu');
						toolList.style.display = 'block';
					});
				}
			});
		});
	});
});

