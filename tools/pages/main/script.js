$js(mithril.client.html5)
$js(custom.libtool)
$js(custom.libsystem)
$js(custom.libgame)
$js(page.views)

var app;
var cfg;

window.mithril.mui.onloaded('main', function () {
	var gameNodeLocation = window.mithrilOrigin || '';

	$('.btn_toview').click(function () {
		var view = $(this).attr('data-target');
		app.views.change(view);
	});

	function login() {
		var params = 'username=' + document.getElementById('user').value + '&password=' + document.getElementById('password').value;	// TODO: input checking

		var startId, startSession;
		var xhr = new XMLHttpRequest();

		xhr.onreadystatechange = function () {
			if (xhr.readyState == 4) {
				if (xhr.status == 401) {
					alert("Authentification failed.\nUsername or password incorrect.");
					return;
				} else if (xhr.responseText) {

					var options = { origin: gameNodeLocation };
					var mithril = window.mithril;
					mithril.setup(options);

					var gm;
					try {
						gm = JSON.parse(xhr.responseText);
					} catch (error) {
						alert('Could not login. ' + error);
					}



					app = new Tool({ width: window.innerWidth, height: window.innerHeight });

					mithril.start(gm.id, gm.session, function(error) {
						if (error) {
							console.log(JSON.stringify(error));
						} else {
							console.log('ready');

							app.init(function () {
								var loginEle = document.getElementById('loginContainer');
								loginEle.style.display = 'none';
								$js(page.viewsetup)
								app.views.change('tool_dashboard');
							});
						}
					});
				}
			}
		}

		xhr.open('POST', '/gmlogin', true);
		xhr.send(params);
	}

	document.getElementById('login').addEventListener('click', function() {
		login();
	});

	function createGm() {
		var rights = ['gc', 'obj'];
		var params = {
			username: $('#user').val(),
			password: $('#password').val(),
			rights: rights
		};

		mithril.gm.createGm(params, function (msg) { alert(msg); });
	}

	function mithrilLogin() {
		var params = {
			username: document.getElementById('user').value,
			password: document.getElementById('password').value
		};
		console.log(params.username, params.password);

		mithril.gm.login(params, function (response) {
			mithril.start(response.id, response.session, function(error) {
				if (error) {
					serverstate.textContent = JSON.stringify(error);
				} else {
					serverstate.textContent = 'ready';
				}
			});
		});
	}
});

