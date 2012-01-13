(function (window) {

	if (!window.EventEmitter) {
		window.alert('EventEmitter not available.');
		return;
	}

	var mithril = window.mithril = new window.EventEmitter();

	mithril.EventEmitter = window.EventEmitter;
	mithril.plugins = {};
	mithril.language = '$app(language)';
	mithril.appName = '$app(name)';


	// expose configuration set up
	// mithril.configure registers the configuration and emits 'configure'

	mithril.configure = function (config) {
		mithril.config = config;

		mithril.emit('configure', config);
	};

}(window));
