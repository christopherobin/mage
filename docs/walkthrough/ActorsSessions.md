# Actors and Sessions

MAGE defines users as "actors", who are represented by an ID (the Actor ID). For an actor to make
the system make changes to the database and send events to other users, it needs to be
authenticated. During authentication, an actor starts a session and is assigned a unique session ID.

As long as a session ID is used and reused by an actor, it will stay active. After a long period
of non-activity however, the session will expire and the actor will be "logged out" as it were.

MAGE is all about concise modules that are responsible for a particular scope of functionality.
You are about to learn about two modules. In MAGE, sessions are created and managed by the "session"
module. Actor authentication is managed by the "ident" module.

## Ident and Session modules

To use these modules, please add the following code in your server code in `lib/index.js`, near the
top of the file:

```javascript
var mage = require('mage');

mage.useModules('ident', 'session');
```

In your web app, we can call the same, although we need to provide an extra argument at the start.

```javascript
var mage = require('mage');

mage.useModules(require, 'ident', 'session');
```

You will also have to add the code of these modules to your project through your component.json
file. The component.json file that goes with the JavaScript file you just added `useModules()` to
should already have a "paths" entry to MAGE itself. To be able to use MAGE modules, you should add
the modules folder to the `paths` array as well.

```json
{
  "paths": [
    "../../../../node_modules/mage/lib"
    "../../../../node_modules/mage/lib/modules"
  ]
}
```

## Logging in

The ident module will allow us to login. For now, let's not bother with user accounts and use the
anonymous login ability instead. As long as we do this as a developer (in development mode),
we can login anonymously and get either user or even administrator privileges. In production that
would be impossible, and running the same logic would result in "anonymous" privileges only. You
wouldn't be able to do much with that.

To login anonymously and get a session, please run the following code.

```javascript
mage.ident.login('anonymous', null, { access: 'user' }, function (error, user) {
	if (error) {
		return console.error('Error logging in:', error);
	}

	console.log('Logged in as:', user);
});
```

The session module will have automatically picked up the session ID that has been assigned to us,
so there is nothing left for us to do.

## Taking it one step further

When you are ready to create user accounts, please read on about how to use and configure the
[ident module](../../lib/modules/ident/Readme.md).


## Next chapter

[The State class](./State.md)
