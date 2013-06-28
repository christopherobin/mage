var mage = require('mage');
var mageLoader = require('loader');


/**
 * This function checks off an item from the checklist on the screen
 */

function done(n) {
	var elm = document.getElementById('chk' + n);
	if (elm) {
		elm.textContent = '☑';
	}
}


mage.useModules(require,
	'logger',
	'time',
	'assets',
	'archivist',
	'session'
);


function setupErrorHandlers() {
	mage.msgServer.on('io.error.auth', function () {
		// We are trying to do something on the server that we are not allowed to do.
		// Should we re-authenticate?

		mage.logger.debug('Authentication error');
	});

	mage.msgServer.on('io.error.busy', function () {
		// You can't run two user commands in parallel, in order to protect ourselves from race
		// conditions on our servers and databases.

		mage.logger.error('IO busy error');
	});

	mage.msgServer.on('io.error.network', function () {
		// We could not complete the user command call to the server due to a network glitch,
		// let's retry in 4 seconds.

		window.setTimeout(function () {
			mage.logger.verbose('Resending...');

			mage.msgServer.resend();
		}, 4000);
	});
}


// Set up all loaded modules. This will allow these modules to hit the server once to sync up.

mageLoader.renderPage('landing');
done(1);

setupErrorHandlers();
done(2);

mage.setup(function () {
	done(3);

	// once our modules' needs have been satisfied, show this screen

	mageLoader.displayPage('landing');
	done(4);

	// download the rest of the game

	mageLoader.loadPage('main');
});


// Commence downloading and execution of the "main" page.

mageLoader.once('main.loaded', function () {
	done(5);

	// Once the main page becomes available, we can run its code by calling require() on it.

	var btn = document.getElementById('navToMain');
	btn.onclick = function () {
		require('main');
	};

	done(6);
});

