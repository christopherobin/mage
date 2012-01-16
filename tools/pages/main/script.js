$html5client(io);
$html5client(modulesystem);
$html5client(module.gm);

$file.bin("../../libtool/jquery-1.7.js");
$file.bin("../../libtool/jqueryui/jquery-ui-1.8.16.custom.js");
$file.bin("../../libtool/jquery.contextMenu.js");
$file.bin("../../libtool/jquery.jsPlumb-1.3.3-all.js");
$file.bin("../../libtool/tool.js");
$dir("../../libtool/general");
$file("../../libtool/viewport/viewport.js");


function loadViews() {
	$toolviewport(all);
}


function loadModules() {
	$html5client(datatypes);
	$html5client(module.assets);
	$html5client(module.session);
	$html5client(module.shop);
	$html5client(module.gc);
	$html5client(module.actor);
	$html5client(module.player);
	$html5client(module.obj);
	$html5client(module.npc);
}


var app;

window.mithril.loader.on('main.loaded', function () {
	window.mithril.loader.displayPage('main');
	mithril.configure({});


	$('.btn_toview').click(function () {
		var view = $(this).attr('data-target');
		window.viewport.change(view);
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

			app = new Tool({ width: window.innerWidth, height: window.innerHeight });

			mithril.session.setSessionKey(session);

			mithril.io.on('io.error', function (path, error) {
				console.error(error);
			});

			mithril.setup(function (error) {
				if (error) {
					return console.log(error);
				} else {
					console.log('ready');

					app.init(function () {
						loadViews();
						var loginEle = document.getElementById('loginContainer');
						loginEle.style.display = 'none';
						window.viewport.change('tool_dashboard');
					});
				}
			});
		});
	});
});

