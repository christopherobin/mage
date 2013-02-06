<a name='top'/>
#How To Write A Bot



##Index
1. [Files You Will Need Add/Modify](#Files You Will Need Add/Modify)
* [Server API](#Server API)
 * [lib/bot.js](#lib/bot.js)
 * [lib/index.js](#lib/index.js)
 * [configs/game/custom.js](#configs/game/custom.js)
* [Testing API](#Testing API)
* [JS Driven Client](#JS Driven Client)
 * [www/botScenarios/< SCENARIO GROUP >.js](#www/botScenarios/&lt; SCENARIO GROUP &gt;.js)
 * [www/botPages/< BOT NAME >/script.js](#www/botPages/&lt; BOT NAME &gt;/script.js)
 * [www/botPages/< BOT NAME >/page.html](#www/botPages/&lt; BOT NAME &gt;/page.html)
 * [www/libgame/nextTick.js](#www/libgame/nextTick.js)
* [Testing client](#Testing client)



<a name='Files You Will Need Add/Modify'/>
##Files You Will Need Add/Modify
<div style="text-align: right"><a href="#top">back to top</a></div>

###Server API
- lib/bot.js:  Registers bot pages and missing API functions
- lib/index.js: Includes lib/bot.js and exposes the API
- configs/game/custom.js: Add configurations for the bot app & module

###JS Driven Client:
- www/botScenarios/< SCENARIO GROUP >.js: Registers scenario functions
- www/botPages/< BOT NAME >/script.js: This is where the magic happens, this is your loader/landing/bot logic.
- www/botPages/< BOT NAME >/page.html: Wrapper html page which includes above bot script.
- www/libgame/nextTick.js: Copy from DRS game, contains enhanced setTimout and nextTick functions.




<a name='Server API'/>
##Server API
<div style="text-align: right"><a href="#top">back to top</a></div>

<a name='lib/bot.js'/>
###lib/bot.js

This file can generally be copied from another game and modified. The main sections
of interest are registration of your bot pages, how a bot is identified and what
game specific player properties need to be set. For a more in-depth example take
a look at DeadRising-TheSurvival game.

<pre>
var mage = require('mage');
var bot = mage.bot;
var async = require('async');

var paths = {
	www: __dirname + '/../www'
};

// List your different bots here
bot.addTestPage('< BOT NAME >', paths.www + '/botPages/< BOT NAME >');

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
</pre>


<a name='lib/index.js'/>
###lib/index.js
<div style="text-align: right"><a href="#top">back to top</a></div>

The general change that needs to be done here is to take game user commands and
wrap them into a generic function. This will be needed by the bot to also expose
them under the bot app. For a working example please take a look at
DeadRising-TheSurvival game.


<pre>
// ....

function exposeGameUserCommands(app) {
    // Your app.commandCenter.expose game specific user commands
}

// ....

function setupBot(cb) {
	logger.info('Setting up BOT interface');

	// Register additional function and pages
	require('./bot.js');

	// Create bot API
	mage.bot.createAPI(function (botApp) {
            // Expose game user commands under botApp
            exposeGameUserCommands(botApp);
            
            // Expose app
            botApp.expose(cb);
        });
}

// ....

mage.setup(configFiles, function () {
	async.series([
		...
		setupBot,
		...
	], function (error) {
		if (error) {
			mage.fatalError(error);
		}
	});
});

</pre>


<a name='configs/game/custom.js'/>
###configs/game/custom.js
<div style="text-align: right"><a href="#top">back to top</a></div>

Here we will need to add two sections to the config. apps.bot & module.bot

<pre>
"apps": {
    "bot": {
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
</pre>

<pre>
"module": {
    "bot": {
            "psk": "< PRE SHARED KEY >"
    }
}
</pre>









<a name='Testing API'/>
##Testing API
<div style="text-align: right"><a href="#top">back to top</a></div>

With this you should be able to access the bot API, which should allow you to write
a client in any format and in turn access the game as a botting mechanism. You should
be able to use tools such as tsung, seige or even curl to start performing game
actions. A quick way to test this is to use curl in the following manner:

<pre>
curl --url http://< HOST >/bot/< USER COMMAND > \
     -H "Host: < EXPOSED DOMAIN NAME >" \
     -d $'[{"name":"bot.psk","key":"< PSK >"}]\n{"options":{< ADDITIONAL OPTIONS >}}'
</pre>








<a name='JS Driven Client'/>
##JS Driven Client
<div style="text-align: right"><a href="#top">back to top</a></div>


<a name='www/botScenarios/&lt; SCENARIO GROUP &gt;.js'/>
###www/botScenarios/< SCENARIO GROUP >.js

These file would be where you would register your scenarios. Each scenario will
consist of a routine it would run along with a condition which would be checked
before it runs. This helps enhance the writting speed of the bot operation.
Generally these scenarios should be written by game developers as the game
production progresses and will come in very handy for unit testing. Most games
should be shipped with a unit testing bot which allows backend/frontend developers
to quickly test for breakage when large overhauls are done. For an in-depth
example please take a look at DeadRising-TheSurvival game.


<pre>
(function (window) {
	// Load external dependencies to local variables
	var mage = window.mage;
	// ....
	var bot = mage.bot;

	// Scenario which plays current mission & boss
	bot.addScenario('< SCENARIO NAME >', function (options, cb) {
		// Code to execute up running this scenario
	}, function (options) {
		// What should be checked prior to running this scenario
		// return TRUE to run or FALSE to skip
	});
}(window));
</pre>


<a name='www/botPages/&lt; BOT NAME &gt;/script.js'/>
###www/botPages/< BOT NAME >/script.js
<div style="text-align: right"><a href="#top">back to top</a></div>

This is where the magic happens for the bot. This file is a hybrid between a
loader page, a landing page and the bot itself. Most of the code can be copied
from another game however the runBot function will change depending on what you
are trying to achieve. For an in-depth example please take a lookg at
DeadRising-TheSurvival game.

<pre>
// ....
// General include code
// ....

// Bot Logic
(function (window) {
	var mage = window.mage;
	var missions = mage.missions;
	var bot = mage.bot;


	function botInitialise(cb) {
		// What to do before we can actully begin running scenarios
	}


	function botRun(cb) {
		// Botting routine, this is where we run our scenarios
	}


	function botClose() {
		// Cleanup routine. Let's be clean about our operations, shall we
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
</pre>


<a name='www/botPages/&lt; BOT NAME &gt;/page.html'/>
###www/botPages/< BOT NAME >/page.html
<div style="text-align: right"><a href="#top">back to top</a></div>

This is a mere html wrapper for our bot. You generally don't need to do much
here if you just want a plain inhuman, automated bot. The code below should
suffice for 99% of situations.

<pre>
&lt;html&gt;

&lt;body&gt;&lt;script&gt;
$dir.js("./");
&lt;/script&gt;&lt;/body&gt;

&lt;/html&gt;
</pre>



<a name='www/libgame/nextTick.js'/>
###www/libgame/nextTick.js
<div style="text-align: right"><a href="#top">back to top</a></div>

This file can be directly copied from anyone of the games which have it. If in
doubt take it from DeadRising-TheSurvival game.



<a name='Testing client'/>
##Testing client
<div style="text-align: right"><a href="#top">back to top</a></div>

This can be done in few ways, however I will list the 2 easiest methods here.
Firstly as we are using complete frontend code for our clients we can easily
just open up the bot page in a browser and it should begin running. Or we can
use the phantomJS loader and use phantomJS to run our client for us. The advantage
of using phantomJS is that it is a headless client option which has no need for
a browser.


###Browser
Open your browser JS console and open the following page
<pre>
http://< HOST >/app/bot/< BOT NAME >#psk=< PRE SHARED KEY >
</pre>

###PhantomJS
Download the loader and running it with the arguments PSK and BOT NAME
<pre>
curl -s http://< HOST >/app/bot/phantom | gunzip > phantom.js
phantomjs phantom.js < PRE SHARED KEY > < BOT NAME >
</pre>