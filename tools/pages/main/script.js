$html5client(io);
$html5client(datatypes);
$html5client(module.assets);
$html5client(module.session);
$html5client(module.shop);
$html5client(module.gc);
$html5client(module.gm);
$html5client(module.actor);
$html5client(module.player);
$html5client(module.obj);
$html5client(module.npc);

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

var app;

window.mithril.loader.on('main.loaded', function () {
	window.mithril.loader.displayPage('main');

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

	// TODO -- io is now loaded whenever I want, so I don't need this ajax stuff anymore
	function login() {
		var params = 'username=' + document.getElementById('user').value + '&password=' + document.getElementById('password').value;	// TODO: input checking

		var startId, startSession;
		var xhr = new XMLHttpRequest();

		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4) {
				if (xhr.status === 401) {
					alert("Authentification failed.\nUsername or password incorrect.");
					return;
				} else if (xhr.responseText) {

					var options = { io: { defaultHooks: ['mithril.session'] } };
					var mithril = window.mithril;
					mithril.configure(options);

					var newSession;
					try {
						newSession = xhr.responseText;
					} catch (error) {
						alert('Could not login. ' + error);
					}


					app = new Tool({ width: window.innerWidth, height: window.innerHeight });

					mithril.session.setSessionKey(newSession);

					mithril.io.on('io.error', function (path, error) {
						console.error(error);
					});

					mithril.setup(function (error) {
						if (error) {
							console.log(JSON.stringify(error));
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
				}
			}
		};

		xhr.open('POST', '/gmlogin', true);
		xhr.send(params);
	}

	document.getElementById('login').addEventListener('click', function () {
		login();
	});
});

