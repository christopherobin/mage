$js(mithril.mithrilui.loader)

(function () {

	var baseUrl = window.location.pathname;
	var packageName = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1);

	window.mithrilOrigin = 'http://$cfg(server.expose.host):$cfg(server.expose.port)';

	var m = /pages=(.+?)(&|$)/.exec(window.location.hash);
	if (!m || !m[1]) {
		return error('No page specified.');
	}

	var pages = decodeURIComponent(m[1]).split(',');

	var language;

	m = /language=(.+?)(&|$)/.exec(window.location.search);
	if (m[1]) {
		language = decodeURIComponent(m[1]);
	}

	window.mithril.mui.setup(language, baseUrl, packageName, pages);

	window.mithril.mui.start();

}());
