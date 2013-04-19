# How To Write A Bot


## Index
1. [Files You Will Need To Add/Modify](#files-you-will-need-to-addmodify)
* [Server API](#server-api)
 * [lib/bot.js](#libbotjs)
 * [lib/index.js](#libindexjs)
 * [configs/game/custom.js](#configsgamecustomjs)
* [Testing API](#testing-api)
* [JS Driven Client](#js-driven-client)
 * [www/botScenarios/&lt;SCENARIO GROUP&gt;.js](#wwwbotscenariosscenario-groupjs)
 * [www/botPages/&lt;BOT NAME&gt;/script.js](#wwwbotpagesbot-namescriptjs)
 * [www/botPages/&lt;BOT NAME&gt;/page.html](#wwwbotpagesbot-namepagehtml)
 * [www/libgame/nextTick.js](#wwwlibgamenexttickjs)
* [Testing client](#testing-client)



## Files You Will Need To Add/Modify
[back to top](#how-to-write-a-bot)

### Server API

- lib/bot.js:  Registers bot pages and missing API functions
- lib/index.js: Includes lib/bot.js and exposes the API
- configs/game/custom.js: Add configurations for the bot app & module

### JS Driven Client:

- www/botScenarios/&lt;SCENARIO GROUP&gt;.js: Registers scenario functions
- www/botPages/&lt;BOT NAME&gt;/script.js: This is where the magic happens, this is your loader/landing/bot logic.
- www/botPages/&lt;BOT NAME&gt;/page.html: Wrapper html page which includes above bot script.
- www/libgame/nextTick.js: Copy from DRS game, contains enhanced setTimout and nextTick functions.



## Server API
[back to top](#how-to-write-a-bot)


### lib/bot.js

This file can generally be copied from another game and modified. The main sections
of interest are registration of your bot pages, how a bot is identified and what
game specific player properties need to be set. For some in-depth examples please
talk with the mage team.

```javascript
var mage = require('mage');
var bot = mage.bot;
var async = require('async');

var paths = {
	www: __dirname + '/../www'
};

// List your different bots here
bot.addTestPage('<BOT NAME>', paths.www + '/botPages/<BOT NAME>');

bot.register('createBotPlayer', function (state, args, cb) {
	// ....
	// General create actor routine
	// ....

	// Identify as bot player i.e. props.set('isBot', true);

	// Set game specific player properties i.e. props.set('mana', mana);

	// ....
	// General create player routine
	// ....
});

bot.register('updateBotPlayer', function (state, args, cb) {
	// Refresh game specific player properties i.e. props.set('mana', mana);
});

bot.register('confirmBotPlayer', function (state, args, cb) {
	// Identify if player is bot
	// i.e. var isBot = props.get('isBot'); if (isBot !== true) { return error; }
});
```



### lib/index.js
[back to top](#how-to-write-a-bot)

The general change that needs to be done here is to take game user commands and
wrap them into a generic function. This will be needed by the bot to also expose
them under the bot app. For a working example please talk with the mage team.


```javascript
function setupBot(cb) {
	logger.info('Setting up BOT interface');

	// Register additional function and pages
	require('./bot.js');

	// Create bot API
	cb();
}

// ....

mage.setup(function () {
	async.series([
		...
		setupBot,
		...
	], function (error) {
		if (error) {
			return mage.fatalError(error);
		}
	});
});

```



### configs/game/custom.js
[back to top](#how-to-write-a-bot)

Here we will need to add two sections to the config. apps.bot & module.bot

```json
{
	"apps": {
		"bot": {
			"access": "user",
			"delivery": {
				"serverCache": false,
				"useManifest": false,
				"compress": true,
				"postprocessors": {
					"css": "less",
					"js": []
				}
			}
		}
	}
}
```

```json
{
	"module": {
		"bot": {
			"psk": "<PRE SHARED KEY>"
		}
	}
}
```


## Testing API
[back to top](#how-to-write-a-bot)

With this you should be able to access the bot API, which should allow you to write
a client in any format and in turn access the game as a botting mechanism. You should
be able to use tools such as tsung, seige or even curl to start performing game
actions. A quick way to test this is to use curl in the following manner:

```bash
curl --url http://<HOST>/bot/<USER COMMAND> \
	 -H "Host: <EXPOSED DOMAIN NAME>" \
	 -d $'[{"name":"bot.psk","key":"<PSK>"}]\n{"options":{<ADDITIONAL OPTIONS>}}'
```


## JS Driven Client
[back to top](#how-to-write-a-bot)


### www/botScenarios/&lt;SCENARIO GROUP&gt;.js

These files would be where you would register your scenarios. Each scenario will
consist of a routine it would run along with a condition which would be checked
before it runs. This helps enhance the writting speed of the bot operation.
Generally these scenarios should be written by game developers as the game
production progresses and will come in very handy for unit testing. Most games
should be shipped with a unit testing bot which allows backend/frontend developers
to quickly test for breakage when large overhauls are done. For some in-depth
examples please talk with the mage team.


```javascript
(function (window) {
	// Load external dependencies to local variables
	var mage = window.mage;
	// ....
	var bot = mage.bot;

	// Scenario which plays current mission & boss
	bot.addScenario('<SCENARIO NAME>', function (options, cb) {
		// Code to execute up running this scenario
	}, function (options) {
		// What should be checked prior to running this scenario
		// return TRUE to run or FALSE to skip
	});
}(window));
```

### www/botPages/&lt;BOT NAME&gt;/script.js
[back to top](#how-to-write-a-bot)

This is where the magic happens for the bot. This file is a hybrid between a
loader page, a landing page and the bot itself. Most of the code can be copied
from another game however the runBot function will change depending on what you
are trying to achieve. For some in-depth examples please talk with the mage team.

```javascript
// ....
// General include code
// ....

// Bot Logic
(function (window) {
	var mage = window.mage;
	var bot = mage.bot;

	function botInitialise(cb) {
		// What to do before we can actually begin running scenarios.
	}

	function botRun(cb) {
		// Botting routine, this is where we run our scenarios.
	}

	function botClose() {
		// Cleanup routine.
	}

	// Logic flow
	botInitialise(function (error) {
		if (error) {
			return botClose();
		}

		botRun(function () {
			return botClose();
		});
	});
}(window));
```




### www/botPages/&lt;BOT NAME&gt;/page.html
[back to top](#how-to-write-a-bot)

This is a mere html wrapper for our bot. You generally don't need to do much
here if you just want a plain inhuman, automated bot. The code below should
suffice for 99% of situations.

```html
<html>

<body><script>
$dir.js("./");
</script></body>

</html>
```


### www/libgame/nextTick.js
[back to top](#how-to-write-a-bot)

This file can be directly copied from anyone of the games which have it. If in
doubt please talk with the mage team.


## Testing client
[back to top](#how-to-write-a-bot)

This can be done in few ways, however two easy methods are listed below.
Firstly as we are using complete frontend code for our clients we can easily
just open up the bot page in a browser and it should begin running. Or we can
use the phantomJS loader and use phantomJS to run our client for us. The advantage
of using phantomJS is that it is a headless client option which has no need for
a browser.


### Browser

Navigate to the following page (make sure your JS console is open to confirm that the bot is running):

`http://<HOST>/app/bot/<BOT NAME>#psk=<PRE SHARED KEY>`

### PhantomJS

Download the loader and run it with the arguments PSK and BOT NAME.

```bash
curl -s http://<HOST>/app/bot/phantom | gunzip > phantom.js
phantomjs phantom.js <PRE SHARED KEY> <BOT NAME>
```
