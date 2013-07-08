# Writing modules

You separate your game logic into logical units we call "modules". Modules consist of three
important pieces:

1. Server side logic.
2. Client side logic.
3. User commands that bridge the gap between client and server.

In this tutorial, we will take the example of a a simple RPG game in which we want to implement the
gift system, with which Alice (from our [previous example](./State.md)) can send 100 gold coins to Bob.


## Integration

### File structure

Modules are layed out on the file system as follows:

```
mygame/
	lib/
		modules/
			gifting/           -- the name of our module
				usercommands/
					gift.js    -- the user command we use to send a gift

				index.js       -- the server side logic
				client.js      -- the client side logic
				component.json -- component configuration
				foo.js         -- any other logic you may want to include, which can be used on ...
				bar.js         -- ... the server, the client, or both!
```


### Integration on the server

We can activate the module by adding its name to the following call in `lib/index.js`:

```javascript
mage.useModules('archivist', 'assets', 'dashboard', 'logger', 'session', 'time', 'gifting');
```

Alternatively, we can add a separate call:

```javascript
// MAGE built-in modules

mage.useModules('archivist', 'assets', 'dashboard', 'logger', 'session', 'time', 'gifting');

// Game modules

mage.useModules('gifting');
```

MAGE will make your module available on its own object as `mage.gifting`.


### Integration on the client

To enable the browser component, we have to emulate what we did on the server by adding the name
of our module to the `useModules` call:

```javascript
mage.useModules(require, 'logger', 'time', 'assets', 'archivist', 'session', 'gifting');
```

Like on the server, we can call `useModules` as many times as we like, and MAGE will make your
module available on its own object as `mage.gifting`.


### About component.json

MAGE uses the popular [component](https://github.com/component/component)
([wiki](https://github.com/component/component/wiki)) library to manage client-side dependencies.
To allow your module to be accessible, please provide it with a `component.json` file that resembles
the following:

```json
{
	"name": "gifting",
	"scripts": [
		"client.js",
		"foo.js"
	],
	"main": "client.js"
}
```

The `name` **must** be the same as the name of your module, in this case `"gifting"`.

The `scripts` field describes all JavaScript files that need to be included as part of this package.
If `client.js` needs to be able to access `foo.js`, it needs to be listed here.

Finally, the `main` field describes which file will be executed when the module is loaded by MAGE.


## Implementing your module

### Server side logic

The server side implementation of a MAGE module is no different from any Node.js module, except for
one special function you may choose to export: `setup`. The setup function will run when MAGE boots
up allowing your module to prepare itself, for example by loading vital information from a data
store into memory.

Example: `lib/modules/gifting/index.js`

```javascript
/**
 * @type {Object}  The types of items that may be gifted and what their maximum amounts are.
 */

var giftingRules;

/**
 * Gifting module setup function
 *
 * @param {State} state        MAGE State.
 * @param {Function} callback  Callback to be called after completion.
 */

exports.setup = function (state, callback) {
	// load gifting rules

	state.archivist.get('gameDefinitions', { type: 'giftingRules' }, function (error, rules) {
		if (error) {
			return callback(error);
		}

		giftingRules = rules;

		callback();
	});
};
```

It's also here that you should add all game logic related to gifting, for example:

```javascript
/**
 * Allows one player to send a gift to another player
 *
 * @param {State} state          MAGE state.
 * @param {string} fromPlayerId  The ID of the player sending the gift.
 * @param {string} toPlayerId    The ID of the player receiving the gift.
 * @param {string} itemType      The type-name of the item being gifted.
 * @param {number} amount        The amount of itemType being gifted.
 * @param {Function} callback    Callback to be called after completion.
 */

var mage = require('mage');

exports.gift = function (state, fromPlayerId, toPlayerId, itemType, amount, callback) {
	// Check if the gift is valid.

	if (!giftRules.hasOwnProperty(itemType)) {
		return state.error(null, 'This item may not be gifted: ' + itemType, callback);
	}

	var maxAmount = giftRules[itemType];

	if (typeof maxAmount === 'number') {
		if (typeof amount !== 'number' || amount > maxAmount) {
			return state.error(null, 'Invalid amount ' + amount + ' for item ' + itemType, callback);
		}
	}

	// Ask the inventory module to reduce the inventory of fromPlayerId.

	mage.inventory.reduce(state, fromPlayerId, itemType, amount, function (error) {
		// If the player did not own enough of this itemType, we will receive an error.

		if (error) {
			return callback(error);
		}

		// Ask the inventory module to increase the inventory of toPlayerId.

		mage.inventory.increase(state, toPlayerId, itemType, amount, callback);
	});
};
```

### Client side logic

On the client side, just like on the server side, we can expose a setup function that gets called
when the game starts. In the following example, we choose to load the giftingRules on the client as
well, so we can inform the player and what is possible and what the limits are.

Example: `lib/modules/gifting/client.js`

```javascript
/**
 * @type {Object}  The types of items that may be gifted and what their maximum amounts are.
 */

var giftingRules;

/**
 * Gifting module setup function
 *
 * @param {Function} callback  Callback to be called after completion.
 */

exports.setup = function (callback) {
	// load gifting rules

	mage.archivist.get('gameDefinitions', { type: 'giftingRules' }, function (error, rules) {
		if (error) {
			return callback(error);
		}

		giftingRules = rules;

		callback();
	});
};
```

### User commands

To allow Alice to do the actual gifting, we need to expose some more logic on the client-side. It
would be nice to have a gift function there (like we already do on the server), but that would call
into the server to execute the gift transaction. When you implement a user command, MAGE will
**automatically** expose it on your client module. The user command function is named the same as
the implementation's filename. Requirements inside the user command are:

- Export an access level.
- Export an `execute` function that contains the logic for the operation and follows the `params`.
- Export a `params` array that describes the `execute` function, but excludes `state` and `callback`, which always exist.

Example: `lib/modules/gifting/usercommands/gift.js`

```javascript
var mage = require('mage');

// The requester needs to be at least an authenticated user.

exports.access = 'user';

// Export the user command's signature.

exports.params = ['fromPlayerId', 'toPlayerId', 'itemType', 'amount'];

// The user command's execution path.

exports.execute = function (state, fromPlayerId, toPlayerId, itemType, amount, callback) {
	// Simply proxy the request into the gifting module's logic.

	mage.gifting.gift(state, fromPlayerId, toPlayerId, itemType, amount, callback);
};
```

Your client module will now not just have a `setup` function, but also a `gift` function! Use your
browser's console to inspect the function, by running the following:

```javascript
var mage = require('mage');
mage.gifting.gift;
```

## And that's it!

Restart your MAGE process to see your module in action!

## Next chapter

[Events](./Events.md)
