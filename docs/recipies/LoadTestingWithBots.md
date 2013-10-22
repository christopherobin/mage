# Load testing with bots

## Concept

Before you deploy a game to production, you will want to test its performance and scalability. To do
that the right way, you will need to be able to automate interactions that mimic the interactions of
real human players. There are good ways to do this with MAGE, and this recipe will tell you how.


## Requirements

In order to use a bot, your game will need to be running in `developmentMode` (inspect your config).
This should **never** be the case on a production environment. This is needed to get the necessary
credentials to create fresh players and sessions with "admin" access. You will probably want your
bot to have admin access, so it can refill particular resources once they are consumed.


## Implementation

There are generally only two phases to your bot:

1. Creating a player and a session, *or* log in with an existing player.
2. Run scenarios that mimic user behavior and interact with the server at high speed.

All this should happen from a web app that contains your bot logic.

### Creating a player and a session

Ideally, your game already contains a user command to create a player. This can be very useful when
used from dashboards. Your bot should use the exact same user command. Since this should only be
possible at the "admin" level, we'll need to get an "admin" session first. After creating the player
we can reassign our current admin session to that player, and we'll be ready to run our bot!

```javascript
// NOTE 1: This works only in development mode
// NOTE 2: No error handling is done in this example, you will have to add this yourself.

mage.session.loginAnonymous('admin', function (error) {
	var currentActorId = mage.session.getActorId();

	// a custom "admin" user command for creating a player (this is up to you to create):

	mage.player.create(function (error, botActorId) {
		// reassign our session

		mage.session.reassignSession(currentActorId, botActorId, function (error) {
			rockAndRoll();
		});
	});
});
```

Alternatively, if you already know the ID of the bot player you want to use, do the following:

```javascript
// NOTE: This works only in development mode

mage.session.loginAsActor(actorId, 'admin', function (error) {
	rockAndRoll();
});
```

### Running your bot

Now you can use a library like async to run your operations, for example:

```javascript
// run quests 'til we drop

function rockAndRoll() {
	async.whilst(
		function () {
			return mage.player.stamina >= mage.quest.getCurrentQuest().requiredStamina;
		},
		function (callback) {
			mage.quest.doQuest(callback);
		},
		function (error) {
			// ...
		}
	);
}
```

### Running low on A, B, C

When your bot needs more resources to continue playing, consider adding "admin" access level user
commands (useful for customer support too), to refill particular stats.

```javascript
mage.player.setResources({ stamina: maxStamina }, function (error) {
	// ...
});
```


## Tools

### PhantomJS

In order to do the things real users would do, we need to run real client-side game code in a
browser. That tends to be hard to automate, but luckily there is [PhantomJS](http://phantomjs.org),
an application that runs a full WebKit browser from the command line. Once you have PhantomJS
[downloaded and installed](http://phantomjs.org/download.html), you can let MAGE create a JavaScript
file for you, that Phantom can run and will access the game.

You do this by running the create-phantom command from the command line, and passing it the app name
of your bot.

For example:

```sh
./game create-phantom bot > ./phantom-loader
```

Now you can run that script by calling:

```sh
./phantom-loader
```

This will access your bot application and start running its client.


### Asynchronous flow control

**Async**

The [async module](https://github.com/caolan/async) that is often used on MAGE backends can also be
used as a component in the browser.

**Next tick**

The [next-tick component](https://github.com/timoxley/next-tick) is a high performance function that
is pretty much "a faster setTimeout(fn, 0)".
