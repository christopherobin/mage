Session Module
==============

Session management.

User Commands
--------------

### isValidSession(sessionKey, callback(err, isValid))

#### Description

Check if a session key still exists in the session
datastore. This can be useful in combination with
the [ident module](../ident) if you wish to persist
sessions on the client (using cookies or local storage),
and you want to check the validity of the stored session
key when the user returns to the application

#### Arguments

* **sessionKey** (String): A session key (see [mage.session.getKey()](./client.js#L35)).
* **callback** (Function): A function to call back when the validation has been performed.

The callback function will be passed the following arguments:

* **err** (Error): An error object. Will be null if no error occured.
* **isValid** (boolean): Will be `true` if the session is valid, `false` if it is not

#### Example

```javascript
var mage = require('mage');
var storeKey = 'sessionKey'
var sessionKey = localStorage.getItem(storeKey);

mage.session.isValidSession(sessionKey, function (err, isValid) {
	if (!isValid) {
		mage.logger.debug('Stored session key is invalid', sessionKey);
		localStorage.removeItem(storeKey);
	} else {
		mage.logger.debug('Stored session key is valid', sessionKey);
		mage.session.setSessionKey(sessionKey);
	}
});

//
// In general, you will have this it of code
// somewhere in your application to save
// the session key locally whenever it gets
// set
//
mage.session.on('sessionKey.set', function (key) {
	mage.logger.debug('Saving session key locally', key);
	localStorage.setItem(storeKey, key);
});
```
