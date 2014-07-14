Session Module
==============

Session management.

User Commands
--------------

### isValid(sessionKey, callback(err))

#### Description

Check if a session key still exists in the session datastore. This can be useful in combination
with the [ident module](../ident) if you wish to persist sessions on the client (using cookies or
local storage), and you want to check the validity of the stored session key when the user returns
to the application.

#### Arguments

* **sessionKey** (String): A session key (see [mage.session.getKey()](./client.js#L35)).
* **callback** (Function): A function to call back when the validation has been performed.

The callback function will be passed the following arguments:

* **err** (String): An error string. Will be null if the session is valid.

#### Example

This example shows how to setup persistent session
on the client, so that it may be reused after each
page reload.

```javascript
var mage = require('mage');
var storeKey = 'sessionKey'
var sessionKey = localStorage.getItem(storeKey);

mage.session.isValid(sessionKey, function (err) {
	if (err) {
		mage.logger.debug('Stored session key is invalid', sessionKey);
		localStorage.removeItem(storeKey);
	} else {
		mage.logger.debug('Stored session key is valid', sessionKey);
		mage.session.setSessionKey(sessionKey);
	}
});

//
// In general, you will have this piece of code
// somewhere in your application to save
// the session key locally whenever it gets
// set
//
mage.eventManager.on('session.set', function (path, session) {
	var sessionKey = session.key;
	mage.logger.debug('Saving session key locally', sessionKey);
	localStorage.setItem(SESSION_KEY, sessionKey);
});
```

### session.restore(sessionKey, callback)

You can restore a session as long as it has not expired by calling session.restore with your
session key.

#### Arguments

* **sessionKey** (String): A session key (see [mage.session.getKey()](./client.js#L35)).
* **callback** (Function): A function to call back when the session has been restored.

The callback function will be passed the following arguments:

* **err** (String): An error string. Will be null if the session is restored successfully.

### session.logout(callback)

You can logout of your existing session causing it to immediately expire.
